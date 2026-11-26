// Downstream of the cheese station, along the accumulation conveyor: the stop gates that hold the
// queued trays, the inspection before the lid (an overhead camera in a washdown hood with
// controlled lighting, plus a laser height scanner) and its pusher, the lidding machine and coder
// (st-downstream-lidding.js), the inspection after the lid (an overhead camera with low side
// lights) and its pusher, and the reject lanes, rework tables, and re-entry chutes
// (st-downstream-rework.js). Drawing code only; no text.

import { clock, isReject1, isReject2, MOVE, P, trayY, work } from "./clock.js";
import { ease, object, PAL } from "./common.js";
import { ACC, BELT, BELT_Z, GATE, LINE_X } from "./layout.js";
import { buildCoder, buildLidding } from "./st-downstream-lidding.js";
import { buildRework, PUSH } from "./st-downstream-rework.js";
import { BLUE, GLOW, keys, STEEL, trayAt } from "./st-downstream-util.js";

const BZ = BELT_Z;
const COL_X = 10.05; // equipment columns stand behind the belt, between it and the feeders

// ---------------------------------------------------------------------------
// Stop gates: a blade rises between the rollers just past each held tray's nose, and drops while
// the trays index (the belt move window). The conveyor end has a fixed end stop.

function buildGates(scene, ctx, T) {
	const g = ctx.group;
	for (const [id, G] of Object.entries(GATE)) {
		if (id === "outfeed") continue;
		const yb = G + 0.35;
		// Air cylinder hung under the front rail, which lifts the blade.
		object(scene, BELT[1] - 0.02, yb - 0.08, BELT[1] + 0.16, yb + 0.08, BZ, (r) => {
			r.box(BELT[1] + 0.02, yb - 0.05, BZ - 0.3, 0.1, 0.1, 0.26, PAL.steelDark);
			r.box(BELT[1] + 0.04, yb - 0.03, BZ - 0.38, 0.06, 0.06, 0.08, STEEL);
		}, { group: g });
		scene.addDynamic({
			group: g,
			depth: LINE_X + yb + 0.01,
			bounds: [BELT[0], yb - 0.05, BZ - 0.05, BELT[1], yb + 0.05, BZ + 0.15],
			animated: () => true,
			draw: (r, t0) => {
				const { u } = clock(T(t0));
				const up = u < 0.15 ? 1 - u / 0.15 : u < MOVE - 0.1 ? 0 : Math.min(1, (u - (MOVE - 0.1)) / 0.25);
				const h = 0.09 * ease(up);
				if (h < 0.01) return;
				r.box(LINE_X - 0.34, yb - 0.015, BZ, 0.68, 0.03, h, BLUE);
			},
		});
	}
	// End stop at the end of the conveyor, where the gantry picks.
	const ye = ACC.y1;
	scene.add({
		group: g,
		live: true,
		depth: LINE_X + ye,
		bounds: [BELT[0], ye - 0.1, 0, BELT[1], ye + 0.05, BZ + 0.2],
		draw: (r) => {
			r.box(BELT[0] + 0.05, ye - 0.07, BZ - 0.1, BELT[1] - BELT[0] - 0.1, 0.07, 0.24, STEEL);
			r.box(BELT[0] + 0.12, ye - 0.09, BZ + 0.02, BELT[1] - BELT[0] - 0.24, 0.02, 0.08, BLUE);
		},
	});
}

// ---------------------------------------------------------------------------
// Inspections: a camera column behind the belt with a sealed controller box, a cantilever arm,
// and a light hood over the tray. The hood is drawn after the tray (it sits above it).

/** A truncated-pyramid hood: bottom rectangle at z0, inset by `inset` at the top z1. */
function hood(r, x0, y0, x1, y1, z0, z1, inset, color) {
	const b = [
		[x0, y0, z0],
		[x1, y0, z0],
		[x1, y1, z0],
		[x0, y1, z0],
	];
	const t = b.map(([x, y]) => [x + (x < (x0 + x1) / 2 ? inset : -inset), y + (y < (y0 + y1) / 2 ? inset : -inset), z1]);
	const faces = [t];
	for (let i = 0; i < 4; i++) {
		const j = (i + 1) % 4;
		faces.push([b[i], b[j], t[j], t[i]]);
	}
	r.mesh(faces, color, { center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
}

/** Translucent light falling from a rectangle at z0 onto a smaller one at z1. */
function lightCone(r, a, b, alpha) {
	const faces = [];
	for (let i = 0; i < 4; i++) {
		const j = (i + 1) % 4;
		faces.push([a[i], a[j], b[j], b[i]]);
	}
	const c = [0, 1, 2].map((q) => (a[0][q] + a[2][q] + b[0][q] + b[2][q]) / 4);
	r.mesh(faces, GLOW, { alpha, flat: true, center: c });
}

const rect = (cx, cy, hx, hy, z) => [
	[cx - hx, cy - hy, z],
	[cx + hx, cy - hy, z],
	[cx + hx, cy + hy, z],
	[cx - hx, cy + hy, z],
];

function buildInspection(scene, ctx, T, { y, k, isRej, scanner, side }) {
	const g = ctx.group;
	const cx = COL_X;
	const armZ = 2.12;
	const hz0 = 1.9; // hood bottom
	// Column, base plate, and the sealed (washdown) controller box for the camera and lights.
	object(scene, cx - 0.17, y - 0.17, cx + 0.17, y + 0.45, 2.25, (r) => {
		r.box(cx - 0.16, y - 0.16, 0, 0.32, 0.32, 0.03, PAL.steelDark);
		r.box(cx - 0.07, y - 0.07, 0, 0.14, 0.14, armZ + 0.1, PAL.steel);
		r.box(cx - 0.13, y + 0.07, 0.95, 0.26, 0.3, 0.42, STEEL);
		r.box(cx - 0.135, y + 0.1, 1.06, 0.01, 0.24, 0.2, PAL.steelDark);
		r.cylinder(cx, y + 0.22, 0.86, 0.03, 0.09, PAL.dark, 6);
	}, { group: g });
	const sy = y - 0.58; // height scanner, just upstream of the camera
	if (scanner)
		object(scene, cx - 0.1, sy - 0.1, cx + 0.1, sy + 0.1, 1.75, (r) => {
			r.box(cx - 0.14, sy - 0.12, 0, 0.28, 0.24, 0.03, PAL.steelDark);
			r.box(cx - 0.06, sy - 0.06, 0, 0.12, 0.12, 1.74, PAL.steel);
		}, { group: g });
	scene.addDynamic({
		group: g,
		depth: LINE_X + y + 0.6,
		bounds: [cx - 0.2, y - 0.9, 0.8, LINE_X + 0.9, y + 0.7, 2.6],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const { n, u } = clock(t);
			const w = work(u);
			const here = trayAt(k, n);
			const lit = here && w > 0.1 && w < 1.5;
			const decided = here && w >= 1.5;
			if (scanner) {
				// Laser profile scanner: a red line across the belt; trays pass under it as they index.
				r.box(cx, sy - 0.05, 1.66, LINE_X + 0.3 - cx, 0.1, 0.08, PAL.steel);
				r.box(LINE_X - 0.25, sy - 0.08, 1.5, 0.5, 0.16, 0.16, STEEL);
				r.box(LINE_X - 0.18, sy + 0.08, 1.52, 0.36, 0.005, 0.04, "#b8322a");
				const ty = trayY(k, u);
				const zl = Math.abs(ty - sy) < 0.3 ? BZ + 0.12 : BZ + 0.005;
				r.quad(
					[
						[LINE_X, sy, 1.5],
						[BELT[0] + 0.12, sy, zl],
						[BELT[1] - 0.12, sy, zl],
					],
					"#ff4a3a",
					{ alpha: 0.12, flat: true },
				);
				r.line([BELT[0] + 0.12, sy, zl], [BELT[1] - 0.12, sy, zl], "#ff3b2f", 1.6);
			}
			// Arm and hood.
			r.box(cx, y - 0.06, armZ, LINE_X - cx + 0.1, 0.12, 0.1, PAL.steel);
			const hx = side ? 0.62 : 0.5;
			r.box(LINE_X - hx, y - 0.5, hz0 - 0.1, 2 * hx, 1.0, 0.1, PAL.steel);
			hood(r, LINE_X - hx, y - 0.5, LINE_X + hx, y + 0.5, hz0, armZ, 0.22, STEEL);
			r.cylinder(LINE_X, y, armZ + 0.1, 0.1, 0.3, PAL.steel, 10);
			r.cylinder(LINE_X, y, armZ + 0.4, 0.07, 0.04, PAL.steelDark, 10);
			r.tube([LINE_X - 0.08, y - 0.05, armZ + 0.32], [cx + 0.05, y - 0.05, armZ + 0.32], 0.02, PAL.dark, 5);
			if (side) {
				// Low-angle bar lights on both sides, so a lifted lid edge casts a shadow.
				for (const lx of [LINE_X - hx + 0.04, LINE_X + hx - 0.04]) {
					r.box(lx - 0.015, y - 0.02, 1.27, 0.03, 0.04, hz0 - 1.27, PAL.steelDark);
					r.box(lx - 0.05, y - 0.36, 1.18, 0.1, 0.72, 0.09, STEEL);
					r.box(lx + (lx < LINE_X ? 0.05 : -0.055), y - 0.33, 1.19, 0.005, 0.66, 0.07, lit ? GLOW : "#9aa3ad");
				}
				if (lit) {
					const zt = BZ + 0.2;
					for (const sgn of [-1, 1]) {
						const lx = LINE_X + sgn * (hx - 0.1);
						r.quad(
							[
								[lx, y - 0.33, 1.22],
								[lx, y + 0.33, 1.22],
								[LINE_X - sgn * 0.2, y + 0.3, zt],
								[LINE_X - sgn * 0.2, y - 0.3, zt],
							],
							GLOW,
							{ alpha: 0.13, flat: true },
						);
					}
				}
			} else {
				// Ring light around the hood mouth (controlled lighting), lit while the camera images.
				r.polyline(rect(LINE_X, y, hx - 0.03, 0.47, hz0 - 0.105), lit ? GLOW : "#6b7580", 1.6, true);
				if (lit) lightCone(r, rect(LINE_X, y, hx - 0.05, 0.45, hz0 - 0.11), rect(LINE_X, y, 0.3, 0.38, BZ + 0.22), 0.1);
			}
			// Verdict lamp on the hood: green pass, red fail, grey while waiting.
			const m = n - k;
			const lamp = !decided ? "#5b6470" : isRej(m) ? "#e0473a" : "#3fbf68";
			r.sphere(LINE_X + hx - 0.18, y + 0.32, armZ + 0.02, 0.055, lamp, 0);
		},
	});
}

// ---------------------------------------------------------------------------
// Pushers: an air cylinder behind the belt; its blue paddle sweeps a failed tray off the front
// edge into the reject lane. The lane module draws the tray once it moves (PUSH timing shared).

function buildPusher(scene, ctx, T, { y, k, isRej }) {
	const g = ctx.group;
	const home = BELT[0] - 0.1;
	// The paddle face is 0.09 past the rod end; it meets the tray's back wall (0.23 from its center).
	const contact = LINE_X - 0.23 - 0.09;
	const end = PUSH.x - 0.23 - 0.09;
	object(scene, 9.7, y - 0.12, BELT[0], y + 0.12, BZ + 0.25, (r) => {
		r.box(9.84, y - 0.08, 0, 0.14, 0.16, BZ + 0.06, PAL.steel);
		r.box(9.76, y - 0.12, 0, 0.3, 0.24, 0.03, PAL.steelDark);
		r.tube([9.74, y, BZ + 0.12], [home - 0.02, y, BZ + 0.12], 0.07, STEEL, 10);
		r.box(9.7, y - 0.08, BZ + 0.04, 0.06, 0.16, 0.16, PAL.steelDark);
		r.cylinder(9.95, y + 0.07, BZ + 0.15, 0.015, 0.06, PAL.dark, 5);
	}, { group: g });
	const paddleX = (n, u) => (isRej(n - k) ? keys([[0, home], [0.6, contact], [1.0, contact], [1.0 + PUSH.dur, end], [2.2, home]], work(u)) : home);
	scene.addDynamic({
		group: g,
		depth: () => {
			const { n, u } = clock(T(scene.time));
			return paddleX(n, u) + y - 0.3;
		},
		bounds: [home - 0.1, y - 0.35, BZ, PUSH.x, y + 0.35, BZ + 0.3],
		animated: () => true,
		draw: (r, t0) => {
			const { n, u } = clock(T(t0));
			const px = paddleX(n, u);
			if (px > home + 0.01) r.tube([home - 0.02, y, BZ + 0.12], [px, y, BZ + 0.12], 0.025, PAL.steel, 6);
			r.box(px, y - 0.06, BZ + 0.06, 0.04, 0.12, 0.12, PAL.steelDark);
			r.box(px + 0.04, y - 0.3, BZ + 0.01, 0.05, 0.6, 0.16, STEEL);
			r.box(px + 0.09, y - 0.27, BZ + 0.03, 0.006, 0.54, 0.11, BLUE);
		},
	});
}

export function build(scene, ctx, T) {
	buildGates(scene, ctx, T);
	buildInspection(scene, ctx, T, { y: GATE["inspect-1"], k: P["inspect-1"], isRej: isReject1, scanner: true, side: false });
	buildPusher(scene, ctx, T, { y: GATE.pusher1, k: P.pusher1, isRej: isReject1 });
	buildLidding(scene, ctx, T);
	buildCoder(scene, ctx, T);
	buildInspection(scene, ctx, T, { y: GATE["inspect-2"], k: P["inspect-2"], isRej: isReject2, scanner: false, side: true });
	buildPusher(scene, ctx, T, { y: GATE.pusher2, k: P.pusher2, isRej: isReject2 });
	buildRework(scene, ctx, T);
}
