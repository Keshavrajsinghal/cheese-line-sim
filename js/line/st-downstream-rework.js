// Reject handling after each inspection: the gravity roller lane from the pusher, through the front
// guard, to a rework table; the tray sliding down it; the rework table itself (stainless, with a
// reject-reason screen, a chilled kit of every item, gloves, spare lids, and a scrap bin); the plates
// waiting on it and the one Operator 2 is fixing; and the covered re-entry chute through the guard
// where fixed plates go back ahead of the camera. Drawing code only; no text.

import { clock, contents, isReject1, isReject2, MOVE, P, work } from "./clock.js";
import { ease, lerp, object, PAL } from "./common.js";
import { drawLid, drawPack, drawPlate, drawSlice, drawWedge, FOOD, frame } from "./food.js";
import { BELT, BELT_Z, GUARD, HEADING, LANES, LINE_X, REENTRY, REWORK } from "./layout.js";
import { op2, rejectsOn } from "./schedule.js";
import { STEEL } from "./st-downstream-util.js";

const BZ = BELT_Z;
/** The pusher sweeps a failed tray to x over dur seconds, starting 1.0 s into the work window. */
export const PUSH = { x: 12.05, dur: 0.5 };
const LANE_TIME = 3.0; // push to table (schedule.js uses the same)
const TZ = 0.82; // rework table top
const WAIT_X = 15.55; // first waiting plate; later ones queue back up the lane
const WAIT_PITCH = 0.52;
const FIX_X = 16.45; // the plate Operator 2 is working on, at the front edge of the table
const SLIDE = 1.0; // seconds for a fixed plate to slide from the hatch mouth under the cover
const MOUTH = 13.4; // where the people module leaves the fixed plate in the chute

const OPEN = { grapes: true, apples: 4, crackers: true, cheese: 4 };
const LIDDED = { ...OPEN, lid: true, code: true };

const TABLES = LANES.map((lane) => {
	const id = lane.id;
	const second = id === "rework-2";
	return { id, lane, t: REWORK[id], re: REENTRY[id], k: second ? P.pusher2 : P.pusher1, isRej: second ? isReject2 : isReject1, second, fixed: second ? LIDDED : OPEN };
});

/** Surface height of a reject lane (a slight fall from the belt to the table). */
const laneZ = (x) => (x <= BELT[1] ? BZ : x >= REWORK["rework-1"].x0 ? TZ : lerp(BZ, TZ, (x - BELT[1]) / (REWORK["rework-1"].x0 - BELT[1])));
/** Surface height of a re-entry chute (falls toward the belt). */
const chuteZ = (x) => (x >= 13.6 ? 1.0 + (x - 13.6) * 0.07 : x >= 12.9 ? lerp(0.95, 1.0, (x - 12.9) / 0.7) : lerp(0.9, 0.95, Math.max(0, x - 11.85) / 1.05));

/** A clear lid that is not seated: lifted along the front edge and turned a little on the tray. */
function tiltedLid(r, cx, cy, z, lift, code) {
	const th = 0.22 * lift;
	const at = frame(cx + 0.02 * lift, cy + 0.035 * lift, z, HEADING + 0.12 * lift, 1);
	const P3 = (f, sd, zz) => {
		const d = sd - 0.24;
		const e = zz - 0.05;
		return at(f, 0.24 + d * Math.cos(th) + e * Math.sin(th), 0.05 + 0.012 * lift + e * Math.cos(th) - d * Math.sin(th));
	};
	const box = (len, wid, z0, z1, alpha) => {
		const c = [];
		for (const zz of [z0, z1]) for (const [f, sd] of [[-len / 2, -wid / 2], [len / 2, -wid / 2], [len / 2, wid / 2], [-len / 2, wid / 2]]) c.push(P3(f, sd, zz));
		const faces = [[c[0], c[1], c[2], c[3]], [c[4], c[5], c[6], c[7]]];
		for (let i = 0; i < 4; i++) faces.push([c[i], c[(i + 1) % 4], c[4 + ((i + 1) % 4)], c[4 + i]]);
		r.mesh(faces, FOOD.lid, { alpha, edge: "rgba(255,255,255,0.9)", center: P3(0, 0, (z0 + z1) / 2) });
	};
	box(0.66, 0.48, 0.05, 0.09, 0.45);
	box(0.58, 0.4, 0.09, 0.2, 0.32);
	if (!code) return;
	r.quad([P3(0.11, -0.17, 0.205), P3(0.23, -0.17, 0.205), P3(0.23, -0.07, 0.205), P3(0.11, -0.07, 0.205)], FOOD.label, { flat: true });
	for (let i = 0; i < 3; i++) r.line(P3(0.125, -0.15 + i * 0.03, 0.206), P3(0.2 - i * 0.012, -0.15 + i * 0.03, 0.206), "#2b2f36", 1.1);
}

/** A rejected plate as it is: short a wedge, or with its lid not seated (lift 0..1). */
function drawReject(r, x, y, z, c, lift = 1) {
	if (c.lidOff && lift > 0) {
		drawPlate(r, x, y, z, HEADING, { ...c, lid: false, code: false }, { noBadge: true });
		tiltedLid(r, x, y, z, lift, c.code);
	} else drawPlate(r, x, y, z, HEADING, c, { noBadge: true });
}

/** What a rejected tray holds when it leaves the belt (the pusher acts 1.0 s into its work window). */
const rejectContents = (tb, m) => contents(m, tb.k, MOVE + 0.99) ?? {};

// ---------------------------------------------------------------------------
// Lanes

function lanePiece(r, y, xa, xb) {
	const za = laneZ(xa);
	const zb = laneZ(xb);
	for (const lx of [12.45, 13.6, 14.75]) if (lx >= xa && lx < xb) for (const dy of [-0.34, 0.28]) r.box(lx - 0.03, y + dy, 0, 0.06, 0.06, laneZ(lx) - 0.08, PAL.steelDark);
	r.beam([xa, y - 0.41, za + 0.01], [xb, y - 0.41, zb + 0.01], 0.04, 0.13, PAL.steel);
	r.quad(
		[
			[xa, y - 0.39, za - 0.03],
			[xb, y - 0.39, zb - 0.03],
			[xb, y + 0.39, zb - 0.03],
			[xa, y + 0.39, za - 0.03],
		],
		"#59616b",
		{ flat: true },
	);
	for (let x = Math.ceil(xa / 0.14) * 0.14; x < xb - 0.02; x += 0.14) r.line([x, y - 0.37, laneZ(x) - 0.005], [x, y + 0.37, laneZ(x) - 0.005], "#b8c0c8", 1.8);
	r.beam([xa, y + 0.41, za + 0.01], [xb, y + 0.41, zb + 0.01], 0.04, 0.13, PAL.steel);
}

function buildLane(scene, ctx, T, tb) {
	const g = ctx.group;
	const y = tb.lane.y;
	const x1 = tb.t.x0;
	const cuts = [BELT[1] + 0.04, GUARD.front, 14.05, x1];
	for (let i = 0; i < cuts.length - 1; i++) {
		const xa = cuts[i];
		const xb = cuts[i + 1];
		object(scene, xa, y - 0.45, xb, y + 0.45, 1.0, (r) => lanePiece(r, y, xa, xb), { group: g });
	}
	// Tunnel header over the guard opening: the gap is only as tall as a tray needs.
	scene.add({
		group: g,
		live: true,
		depth: GUARD.front + y + 0.05,
		bounds: [GUARD.front - 0.05, y - 0.46, 1.3, GUARD.front + 0.05, y + 0.46, GUARD.h],
		draw: (r) => {
			const fx = GUARD.front;
			r.quad(
				[
					[fx, y - 0.45, 1.4],
					[fx, y + 0.45, 1.4],
					[fx, y + 0.45, GUARD.h - 0.08],
					[fx, y - 0.45, GUARD.h - 0.08],
				],
				PAL.guardPanel,
				{ alpha: 0.38, edge: "rgba(120,150,170,0.6)" },
			);
			r.box(fx - 0.03, y - 0.45, 1.34, 0.06, 0.9, 0.06, PAL.guardPost);
		},
	});
	// The pushed tray: swept off the belt, then rolling down the lane to its place in the queue.
	const slide = (t) => {
		const { n, u } = clock(t);
		const m = n - tb.k;
		if (!tb.isRej(m)) return null;
		const s = work(u) - 1.0;
		if (s < 0 || s >= LANE_TIME) return null;
		const waiting = rejectsOn(tb.id, t).filter((f) => !f.fixing).length;
		const target = WAIT_X - WAIT_PITCH * waiting;
		const x = s < PUSH.dur ? lerp(LINE_X, PUSH.x, ease(s / PUSH.dur)) : lerp(PUSH.x, target, ease((s - PUSH.dur) / (LANE_TIME - PUSH.dur)));
		return { m, x };
	};
	scene.addDynamic({
		group: g,
		depth: () => (slide(T(scene.time))?.x ?? LINE_X) + y + 0.02,
		bounds: [LINE_X - 0.4, y - 0.45, BZ - 0.1, x1 + 0.6, y + 0.45, BZ + 0.45],
		animated: () => true,
		draw: (r, t0) => {
			const s = slide(T(t0));
			if (s) drawReject(r, s.x, y, laneZ(s.x), rejectContents(tb, s.m));
		},
	});
	return slide;
}

// ---------------------------------------------------------------------------
// Rework table

function drawKit(r, x0, y0, x1, y1, second) {
	// Chilled kit: an insulated tray on ice packs with a little of every item.
	r.box(x0, y0, TZ, x1 - x0, y1 - y0, 0.03, "#cfe8f5");
	r.box(x0, y0, TZ + 0.03, x1 - x0, 0.03, 0.08, "#eef5fa");
	r.box(x0, y0, TZ + 0.03, 0.03, y1 - y0, 0.08, "#eef5fa");
	const z = TZ + 0.035;
	for (let i = 0; i < 4; i++) drawWedge(r, x0 + 0.12 + i * 0.15, y0 + 0.12, z, 0.75, 2.2 + i, i);
	drawSlice(r, x0 + 0.13, y0 + 0.28, z, 0.8, 0, Math.PI / 2);
	drawSlice(r, x0 + 0.26, y0 + 0.28, z + 0.01, 0.8, 0.3, Math.PI / 2);
	drawPack(r, x0 + 0.52, y0 + 0.27, z, 0.85, second ? 0.2 : -0.3);
	r.box(x1 - 0.03, y0, TZ + 0.03, 0.03, y1 - y0, 0.08, "#eef5fa");
	r.box(x0, y1 - 0.03, TZ + 0.03, x1 - x0, 0.03, 0.08, "#eef5fa");
}

function drawTable(r, tb) {
	const { x0, x1, y0, y1 } = tb.t;
	const legs = [
		[x0 + 0.05, y0 + 0.05],
		[x1 - 0.11, y0 + 0.05],
		[x0 + 0.05, y1 - 0.11],
		[x1 - 0.11, y1 - 0.11],
	];
	for (const [lx, ly] of legs.slice(0, 3)) r.box(lx, ly, 0, 0.06, 0.06, TZ - 0.04, PAL.steel);
	r.box(x0 + 0.05, y0 + 0.05, 0.18, x1 - x0 - 0.1, y1 - y0 - 0.1, 0.03, PAL.steel);
	// Scrap bin under the table on Operator 2's side (red lid), for plates that can't be saved.
	r.cylinder(x1 - 0.4, y1 - 0.42, 0.21, 0.24, 0.36, "#8e98a4", 10);
	r.cylinder(x1 - 0.4, y1 - 0.42, 0.57, 0.25, 0.08, PAL.danger, 10);
	r.box(legs[3][0], legs[3][1], 0, 0.06, 0.06, TZ - 0.04, PAL.steel);
	r.box(x0, y0, TZ - 0.04, x1 - x0, y1 - y0, 0.04, PAL.steel, { top: "#d5dbe0" });
	// Raised back edge along the lane side (washdown table with a lip), broken where the lane enters.
	r.box(x0, y0, TZ, 0.03, tb.lane.y - 0.42 - y0, 0.05, PAL.steel);
	r.box(x0, tb.lane.y + 0.42, TZ, 0.03, y1 - tb.lane.y - 0.42, 0.05, PAL.steel);
	// Gloves: a dispenser box with a blue glove showing.
	r.box(x0 + 0.1, y0 + 0.06, TZ, 0.32, 0.26, 0.11, "#f4f6f8");
	r.box(x0 + 0.18, y0 + 0.1, TZ + 0.11, 0.16, 0.18, 0.005, "#c9d3dc");
	r.sphere(x0 + 0.26, y0 + 0.19, TZ + 0.12, 0.05, "#5aa9e6", 0, { sz: 0.6 });
	if (tb.second) {
		// Spare label roll for relabelling.
		r.tube([x0 + 0.75, y0 + 0.12, TZ + 0.1], [x0 + 0.75, y0 + 0.24, TZ + 0.1], 0.1, "#f4f4f0", 10);
		r.tube([x0 + 0.75, y0 + 0.11, TZ + 0.1], [x0 + 0.75, y0 + 0.25, TZ + 0.1], 0.035, PAL.steelDark, 6);
	}
	drawKit(r, x0 + 0.08, y1 - 0.42, x0 + 0.8, y1 - 0.04, tb.second);
	// Spare lids, nested.
	for (let i = 0; i < (tb.second ? 5 : 3); i++) drawLid(r, x1 - 0.32, y1 - 0.27, TZ - 0.04 + i * 0.03, HEADING, 0.75);
}

const ALERT = "#c0392b";

/** The table's screen, facing Operator 2: red with an alert sign and the reason, or a green tick. */
function drawScreen(r, tb, alert, blink) {
	const [sx, sy] = tb.t.screen;
	const my = sy;
	r.box(sx - 0.1, my - 0.03, TZ, 0.06, 0.06, 1.18 - TZ, PAL.steelDark);
	r.box(sx - 0.08, my - 0.26, 1.13, 0.06, 0.52, 0.38, "#2b3038");
	const x = sx - 0.015;
	const P2 = (yy, zz) => [x, my + yy, zz];
	r.quad([P2(-0.23, 1.16), P2(0.23, 1.16), P2(0.23, 1.48), P2(-0.23, 1.48)], alert ? ALERT : "#1d4732", { flat: true });
	if (!alert) {
		r.polyline([P2(0.06, 1.33), P2(0.01, 1.26), P2(-0.08, 1.41)], "#5fd38d", 2.4);
		return;
	}
	if (blink) {
		r.quad([P2(0.03, 1.21), P2(0.2, 1.21), P2(0.115, 1.43)], "#ffd84a", { flat: true });
		r.quad([P2(0.108, 1.28), P2(0.122, 1.28), P2(0.122, 1.37), P2(0.108, 1.37)], "#2b2f36", { flat: true });
		r.quad([P2(0.108, 1.235), P2(0.122, 1.235), P2(0.122, 1.255), P2(0.108, 1.255)], "#2b2f36", { flat: true });
	}
	if (tb.second) {
		// A tray with its lid lifted off at an angle.
		r.quad([P2(-0.21, 1.22), P2(-0.03, 1.22), P2(-0.03, 1.26), P2(-0.21, 1.26)], FOOD.tray, { flat: true });
		r.quad([P2(-0.22, 1.29), P2(-0.03, 1.35), P2(-0.03, 1.38), P2(-0.22, 1.32)], "#bfe6f7", { flat: true });
	} else {
		// A wedge of brie, struck through: one wedge short.
		r.quad([P2(-0.19, 1.24), P2(-0.03, 1.24), P2(-0.11, 1.4)], FOOD.cheese[3], { flat: true });
		r.line(P2(-0.2, 1.22), P2(-0.02, 1.42), "#ffffff", 2.2);
	}
}

function buildTable(scene, ctx, T, tb, slide) {
	const g = ctx.group;
	const { x0, x1, y0, y1 } = tb.t;
	const ym = tb.lane.y;
	object(scene, x0, y0, x1, y1, 1.0, (r) => drawTable(r, tb), { group: g });
	// Screen (state changes with the plates on the table and on the lane).
	const [sx, sy] = tb.t.screen;
	scene.addDynamic({
		group: g,
		depth: sx + sy,
		bounds: [sx - 0.12, sy - 0.3, TZ, sx + 0.02, sy + 0.3, 1.55],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const alert = rejectsOn(tb.id, t).length > 0 || slide(t) !== null;
			drawScreen(r, tb, alert, ctx.reducedMotion() || t % 1 < 0.7);
		},
	});
	// Plates on the table: waiting in a queue at the lane end, or at the front edge being fixed.
	const spot = (t, m) => {
		const list = rejectsOn(tb.id, t);
		const f = list.find((q) => q.m === m);
		if (!f) return null;
		if (f.fixing) return FIX_X;
		return WAIT_X - WAIT_PITCH * list.filter((q) => !q.fixing).indexOf(f);
	};
	const posOf = (t, m) => {
		let sum = 0;
		let cnt = 0;
		for (const d of [0, 0.15, 0.3, 0.45]) {
			const x = spot(t - d, m);
			if (x === null) continue;
			sum += x;
			cnt++;
		}
		return cnt ? sum / cnt : WAIT_X;
	};
	scene.addDynamic({
		group: g,
		depth: x0 + 0.4 + ym,
		bounds: [12.5, ym - 0.45, 0, x1, ym + 0.45, 1.3],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const list = rejectsOn(tb.id, t);
			if (!list.length) return;
			const op = op2(t);
			const fixK = op.kind === "fix" && op.task === tb.id ? op.k : 0;
			const plates = list.map((f) => ({ f, x: posOf(t, f.m) })).sort((a, b) => a.x - b.x);
			for (const { f, x } of plates) {
				const c = { ...rejectContents(tb, f.m) };
				let lift = 1;
				if (f.fixing && fixK >= 0.55) {
					if (tb.second) lift = 0;
					else c.cheese = 4;
				}
				drawReject(r, x, ym, laneZ(x), c, lift);
			}
		},
	});
}

// ---------------------------------------------------------------------------
// Re-entry chute: a short sloped roller chute through a covered hatch in the front guard. Operator 2
// sets the fixed plate at its mouth; it rolls in under the cover and rejoins the conveyor ahead of
// the camera.

function chutePiece(r, y, xa, xb) {
	for (const lx of [12.4, 13.55]) if (lx >= xa && lx < xb) for (const dy of [-0.32, 0.26]) r.box(lx - 0.03, y + dy, 0, 0.06, 0.06, chuteZ(lx) - 0.06, PAL.steelDark);
	r.beam([xa, y - 0.41, chuteZ(xa) + 0.01], [xb, y - 0.41, chuteZ(xb) + 0.01], 0.04, 0.13, PAL.steel);
	r.quad(
		[
			[xa, y - 0.39, chuteZ(xa) - 0.03],
			[xb, y - 0.39, chuteZ(xb) - 0.03],
			[xb, y + 0.39, chuteZ(xb) - 0.03],
			[xa, y + 0.39, chuteZ(xa) - 0.03],
		],
		"#59616b",
		{ flat: true },
	);
	for (let x = Math.ceil(xa / 0.14) * 0.14; x < xb - 0.02; x += 0.14) r.line([x, y - 0.37, chuteZ(x) - 0.005], [x, y + 0.37, chuteZ(x) - 0.005], "#b8c0c8", 1.8);
	r.beam([xa, y + 0.41, chuteZ(xa) + 0.01], [xb, y + 0.41, chuteZ(xb) + 0.01], 0.04, 0.13, PAL.steel);
}

function buildReentry(scene, ctx, T, tb) {
	const g = ctx.group;
	const y = tb.re.y;
	const xa = BELT[1] + 0.06;
	const xm = GUARD.front;
	const xb = tb.re.x1 + 0.18;
	object(scene, xa, y - 0.45, xm, y + 0.45, 1.0, (r) => chutePiece(r, y, xa, xm), { group: g });
	object(scene, xm, y - 0.45, xb, y + 0.45, 1.1, (r) => {
		chutePiece(r, y, xm, xb);
		r.box(xb - 0.04, y - 0.41, chuteZ(xb) - 0.03, 0.04, 0.82, 0.1, PAL.steel);
	}, { group: g });
	// Cover over the lower chute, with a strip curtain at the mouth and a guard header above it.
	const c0 = 12.2;
	const c1 = 13.15;
	const top = 1.24;
	scene.add({
		group: g,
		live: true,
		depth: c1 + 0.25 + y,
		bounds: [c0, y - 0.46, BZ, c1 + 0.05, y + 0.46, GUARD.h],
		draw: (r) => {
			r.box(c0, y - 0.45, top, c1 - c0, 0.9, 0.04, STEEL);
			r.quad(
				[
					[c0, y + 0.45, chuteZ(c0) - 0.03],
					[c1, y + 0.45, chuteZ(c1) - 0.03],
					[c1, y + 0.45, top],
					[c0, y + 0.45, top],
				],
				PAL.steel,
			);
			for (let i = 0; i < 6; i++) {
				const ya = y - 0.42 + i * 0.14;
				r.quad(
					[
						[c1 + 0.005, ya, chuteZ(c1) + 0.01],
						[c1 + 0.005, ya + 0.125, chuteZ(c1) + 0.01],
						[c1 + 0.005, ya + 0.125, top],
						[c1 + 0.005, ya, top],
					],
					"#d6ecf5",
					{ alpha: 0.5, flat: true },
				);
			}
			r.box(c1 - 0.02, y - 0.47, chuteZ(c1) - 0.04, 0.04, 0.04, top - chuteZ(c1) + 0.08, PAL.steel);
			r.box(c1 - 0.02, y + 0.43, chuteZ(c1) - 0.04, 0.04, 0.04, top - chuteZ(c1) + 0.08, PAL.steel);
			const fx = GUARD.front;
			r.quad(
				[
					[fx, y - 0.4, top + 0.04],
					[fx, y + 0.4, top + 0.04],
					[fx, y + 0.4, GUARD.h - 0.08],
					[fx, y - 0.4, GUARD.h - 0.08],
				],
				PAL.guardPanel,
				{ alpha: 0.38, edge: "rgba(120,150,170,0.6)" },
			);
		},
	});
	// The fixed plate, from the end of Operator 2's "return" until it is under the cover.
	const slideX = (t) => {
		for (const d of [0, 0.35, 0.7, 1.05, 1.4]) {
			const p = op2(t - d);
			if (p.kind !== "return" || p.task !== tb.id) continue;
			if (d === 0) return null; // still in Operator 2's hands
			const end = t - d + (1 - p.k) * 1.5;
			const s = t - end;
			if (s < 0 || s >= SLIDE) return null;
			return lerp(MOUTH, c0 + 0.3, (s / SLIDE) ** 1.6);
		}
		return null;
	};
	scene.addDynamic({
		group: g,
		depth: () => (slideX(T(scene.time)) ?? MOUTH) + y - 0.1,
		bounds: [c0, y - 0.45, BZ, MOUTH + 0.3, y + 0.45, 1.3],
		animated: () => true,
		draw: (r, t0) => {
			const x = slideX(T(t0));
			if (x !== null) drawPlate(r, x, y, chuteZ(x), HEADING, tb.fixed, { noBadge: true });
		},
	});
}

export function buildRework(scene, ctx, T) {
	for (const tb of TABLES) {
		const slide = buildLane(scene, ctx, T, tb);
		buildTable(scene, ctx, T, tb, slide);
		buildReentry(scene, ctx, T, tb);
	}
}
