// Lidding and coding. The lidding machine is one bought unit: a lid magazine that Operator 1 loads
// with nested stacks of clear snap-on lids from the supply aisle (an infeed through the back guard
// carries the stacks to the denester), a lid denester that drops the bottom lid of the stack onto a
// shuttle nest, a placer (a fixed pick-and-place with 4 small suction cups) that sets the lid on the
// tray, and a press ring that pushes the lid down until it snaps. Then a print-and-apply coder
// prints the use-by date and lot code on a label and tamps it onto the lid. Drawing code only.

import { clock, P, work } from "./clock.js";
import { lerp, object, PAL } from "./common.js";
import { drawLid, FOOD } from "./food.js";
import { BELT_Z, GATE, HEADING, LINE_X } from "./layout.js";
import { level } from "./schedule.js";
import { BLUE, HOUSING, keys, SERVO, STEEL, trayAt } from "./st-downstream-util.js";

const BZ = BELT_Z;
const LY = GATE.lidding;
const MAG = { x0: 5.75, x1: 8.75, z: 1.0 }; // infeed magazine conveyor (loading end in the aisle)
const QUEUE = [8.2, 7.45, 6.7]; // queued lid stacks, nearest the denester first
const DEN = { x: 9.1, z: 1.0 }; // the active stack, its bottom lid held by the denester
const STACK_H = 0.55; // a full stack of nested lids (four stacks make the magazine's 250)
const NEST = { under: DEN.x, pick: 9.95, z: 0.76 }; // shuttle nest: under the stack, and at the pick point
const ZZ = { nest: NEST.z - 0.05, stack: DEN.z - 0.05, up: 1.15, seat: BZ }; // lid (tray-bottom) heights
const BEAM_Y = [LY - 0.58, LY - 0.38]; // placer slide beam, upstream of the press
const BEAM_Z = 1.6;
const PRESS = { home: 1.76, down: BZ + 0.09 }; // press ring bottom: parked, and on the lid flange
const COL = [9.86, LY + 0.85]; // press column
const RING = "#7f8b98";

/** A nested stack of clear lids standing at (x, y) from z0, h tall. */
function lidStack(r, x, y, z0, h) {
	if (h < 0.01) return;
	r.orientedBox(x, y, z0, 0.66, 0.48, h, HEADING, FOOD.lid, { alpha: 0.5, edge: "rgba(255,255,255,0.85)" });
	for (let z = z0 + 0.035; z < z0 + h - 0.01; z += 0.035)
		r.polyline(
			[
				[x - 0.24, y + 0.33, z],
				[x + 0.24, y + 0.33, z],
				[x + 0.24, y - 0.33, z],
			],
			"rgba(255,255,255,0.75)",
			1,
		);
	r.orientedBox(x, y, z0 + h, 0.58, 0.4, 0.05, HEADING, FOOD.lid, { alpha: 0.4, edge: "rgba(255,255,255,0.85)" });
}

/** Placer pose: x over the line, lid (tray-bottom) height zz, and whether it holds a lid. */
function placer(n, u) {
	const w = work(u);
	if (!trayAt(P.lidding, n)) return { x: NEST.pick, zz: ZZ.up, hold: true };
	const x = keys(
		[
			[0, NEST.pick],
			[0.6, LINE_X],
			[2.1, LINE_X],
			[2.7, NEST.pick],
		],
		w,
	);
	const zz = keys(
		[
			[0.6, ZZ.up],
			[1.45, ZZ.seat + 0.025],
			[1.8, ZZ.seat], // slow last 10 mm; the tray gains the lid at PLACE.lidding
			[2.1, ZZ.up],
			[2.7, ZZ.up],
			[3.1, ZZ.nest],
			[3.5, ZZ.up], // peel the next lid off the nest
		],
		w,
	);
	return { x, zz, hold: w < 1.8 || w >= 3.1 };
}

const pressZ = (n, u) =>
	trayAt(P.lidding, n)
		? keys(
				[
					[2.4, PRESS.home],
					[2.8, PRESS.down],
					[3.05, PRESS.down],
					[3.45, PRESS.home],
				],
				work(u),
			)
		: PRESS.home;

/** Shuttle nest: where it is, whether a lid sits on it, and the lid dropping from the stack. */
function nest(n, u) {
	const w = work(u);
	if (!trayAt(P.lidding, n)) return { x: NEST.pick, lid: true, fall: null };
	const x = keys(
		[
			[3.5, NEST.pick],
			[4.0, NEST.under],
			[4.4, NEST.under],
			[5.0, NEST.pick],
		],
		w,
	);
	const fall = w >= 4.0 && w < 4.3 ? lerp(ZZ.stack, ZZ.nest, ((w - 4.0) / 0.3) ** 2) : null;
	return { x, lid: w < 3.1 || w >= 4.3, fall };
}

export function buildLidding(scene, ctx, T) {
	const g = ctx.group;
	// Infeed magazine conveyor: stacks are set on at the aisle end, through the back guard opening.
	for (const [xa, xb] of [
		[MAG.x0, 7.25],
		[7.25, MAG.x1],
	])
		object(scene, xa, LY - 0.45, xb, LY + 0.45, MAG.z + 0.1, (r) => {
			for (const lx of [6.3, 8.35]) if (lx >= xa && lx < xb) for (const dy of [-0.32, 0.26]) r.box(lx, LY + dy, 0, 0.06, 0.06, MAG.z - 0.08, PAL.steelDark);
			r.box(xa, LY - 0.42, MAG.z - 0.12, xb - xa, 0.05, 0.17, PAL.steel);
			r.box(xa, LY - 0.36, MAG.z - 0.1, xb - xa, 0.72, 0.1, PAL.steel);
			r.ground(xa, LY - 0.34, xb - xa, 0.68, PAL.belt, MAG.z - 0.002);
			r.box(xa, LY + 0.37, MAG.z - 0.12, xb - xa, 0.05, 0.17, PAL.steel);
		}, { group: g });
	// Machine base with the denester, the shuttle rail, and the lidder's own small panel.
	object(scene, 8.75, LY - 0.6, 10.3, LY + 0.6, 1.0, (r) => {
		r.box(8.75, LY - 0.55, 0, 1.55, 1.1, 0.6, HOUSING, { top: STEEL });
		r.quad(
			[
				[8.9, LY + 0.555, 0.32],
				[9.35, LY + 0.555, 0.32],
				[9.35, LY + 0.555, 0.52],
				[8.9, LY + 0.555, 0.52],
			],
			PAL.screen,
			{ flat: true },
		);
		r.line([8.95, LY + 0.556, 0.47], [9.2, LY + 0.556, 0.47], PAL.screenOn, 1.6);
		r.box(8.86, LY - 0.07, 0.6, 1.38, 0.14, 0.1, PAL.steelDark);
		for (const dy of [-0.46, 0.4]) r.box(8.78, LY + dy, 0.6, 0.06, 0.06, 0.36, PAL.steel);
		// Placer slide column.
		r.box(9.45, BEAM_Y[0], 0.6, 0.15, BEAM_Y[1] - BEAM_Y[0], BEAM_Z - 0.6, PAL.steel);
	}, { group: g });
	object(scene, 9.45, BEAM_Y[0], 11.55, BEAM_Y[1], BEAM_Z + 0.12, (r) => r.box(9.45, BEAM_Y[0], BEAM_Z, 2.1, BEAM_Y[1] - BEAM_Y[0], 0.12, PAL.steel, { top: STEEL }), { group: g });
	object(scene, COL[0] - 0.15, COL[1] - 0.15, COL[0] + 0.15, COL[1] + 0.15, 2.14, (r) => {
		r.box(COL[0] - 0.15, COL[1] - 0.15, 0, 0.3, 0.3, 0.03, PAL.steelDark);
		r.box(COL[0] - 0.08, COL[1] - 0.08, 0, 0.16, 0.16, 2.14, PAL.steel);
	}, { group: g });

	// Shuttle nest, and the bottom lid dropping onto it.
	scene.addDynamic({
		group: g,
		depth: DEN.x + LY - 0.3,
		bounds: [8.8, LY - 0.45, 0.6, 10.3, LY + 0.45, 1.1],
		animated: () => true,
		draw: (r, t0) => {
			const { n, u } = clock(T(t0));
			const s = nest(n, u);
			if (s.fall !== null) drawLid(r, DEN.x, LY, s.fall, HEADING);
			r.box(s.x - 0.26, LY - 0.36, NEST.z - 0.04, 0.52, 0.72, 0.04, STEEL);
			if (s.lid) drawLid(r, s.x, LY, ZZ.nest, HEADING);
		},
	});

	// Magazine: queued stacks on the infeed and the active stack in the denester's collar.
	scene.addDynamic({
		group: g,
		depth: DEN.x + LY + 0.1,
		bounds: [MAG.x0, LY - 0.5, 0.9, DEN.x + 0.4, LY + 0.5, 1.8],
		animated: () => true,
		draw: (r, t0) => {
			const L = level("lids", T(t0)) * 4;
			const queued = Math.min(3, Math.max(0, Math.ceil(L - 1e-6) - 1));
			const a = Math.min(1, L - queued);
			for (let i = queued - 1; i >= 0; i--) lidStack(r, QUEUE[i], LY, MAG.z, STACK_H);
			const x0 = DEN.x - 0.3;
			const x1 = DEN.x + 0.3;
			const y0 = LY - 0.4;
			const y1 = LY + 0.4;
			const cz = DEN.z - 0.07;
			r.box(x0, y0, cz, 0.05, y1 - y0, 0.1, PAL.steel);
			r.box(x0, y0, cz, x1 - x0, 0.05, 0.1, PAL.steel);
			for (const [rx, ry] of [
				[x0, y0],
				[x1 - 0.04, y0],
				[x0, y1 - 0.04],
			])
				r.box(rx, ry, cz + 0.1, 0.04, 0.04, 0.68, PAL.steelDark);
			lidStack(r, DEN.x, LY, DEN.z, STACK_H * a);
			r.box(x1 - 0.05, y0, cz, 0.05, y1 - y0, 0.1, PAL.steel);
			r.box(x0, y1 - 0.05, cz, x1 - x0, 0.05, 0.1, PAL.steel);
			for (const [sx, sy] of [
				[x1 - 0.025, LY - 0.2],
				[x1 - 0.025, LY + 0.2],
				[DEN.x, y1 - 0.025],
			])
				r.cylinder(sx, sy, cz - 0.03, 0.03, 0.08, PAL.dark, 6);
			r.box(x1 - 0.04, y1 - 0.04, cz + 0.1, 0.04, 0.04, 0.68, PAL.steelDark);
		},
	});

	// Placer: carriage on the slide, an arm out to the vertical axis, a head with 4 suction cups.
	const placerX = () => {
		const { n, u } = clock(T(scene.time));
		return placer(n, u).x;
	};
	scene.addDynamic({
		group: g,
		depth: () => placerX() + LY + 0.6,
		bounds: [9.5, BEAM_Y[0] - 0.1, BZ, LINE_X + 0.45, LY + 0.45, BEAM_Z + 0.3],
		animated: () => true,
		draw: (r, t0) => {
			const { n, u } = clock(T(t0));
			const { x, zz, hold } = placer(n, u);
			const cup = zz + 0.205;
			r.box(x - 0.13, BEAM_Y[0] - 0.04, BEAM_Z - 0.05, 0.26, BEAM_Y[1] - BEAM_Y[0] + 0.08, 0.22, SERVO);
			r.box(x - 0.04, BEAM_Y[1] + 0.04, BEAM_Z + 0.02, 0.08, LY - BEAM_Y[1] - 0.02, 0.07, STEEL);
			if (hold) drawLid(r, x, LY, zz, HEADING);
			for (const [dx, dy] of [
				[-0.11, -0.17],
				[0.11, -0.17],
				[-0.11, 0.17],
				[0.11, 0.17],
			])
				r.cylinder(x + dx, LY + dy, cup, 0.028, 0.03, BLUE, 7);
			r.box(x - 0.15, LY - 0.22, cup + 0.03, 0.3, 0.44, 0.03, PAL.steelDark);
			r.box(x - 0.025, LY - 0.025, cup + 0.06, 0.05, 0.05, BEAM_Z + 0.02 - cup - 0.06, PAL.steel);
		},
	});

	// Press: a ring that pushes the lid flange down until it snaps, on an air cylinder hung from the
	// press column's arms; a stack light shows the lidder running (green) or starved (amber).
	scene.addDynamic({
		group: g,
		depth: LINE_X + LY + 0.7,
		bounds: [COL[0] - 0.2, LY - 0.45, BZ, LINE_X + 0.35, COL[1] + 0.2, 2.6],
		animated: () => true,
		draw: (r, t0) => {
			const { n, u } = clock(T(t0));
			const pz = pressZ(n, u);
			const rx = 0.27;
			const ry = 0.36;
			const b = 0.05;
			r.cylinder(LINE_X, LY, 1.86, 0.08, 0.16, STEEL, 10);
			r.cylinder(LINE_X, LY, pz + 0.17, 0.025, 1.86 - pz - 0.17, PAL.steel, 6);
			r.box(LINE_X - rx, LY - ry, pz, 2 * rx, b, 0.04, RING);
			r.box(LINE_X - rx, LY - ry, pz, b, 2 * ry, 0.04, RING);
			for (const dx of [-0.2, 0.2]) r.box(LINE_X + dx - 0.02, LY - 0.02, pz + 0.04, 0.04, 0.04, 0.11, PAL.steel);
			r.box(LINE_X - 0.22, LY - 0.06, pz + 0.14, 0.44, 0.12, 0.03, PAL.steelDark);
			r.box(LINE_X + rx - b, LY - ry, pz, b, 2 * ry, 0.04, RING);
			r.box(LINE_X - rx, LY + ry - b, pz, 2 * rx, b, 0.04, RING);
			r.box(LINE_X - 0.08, LY - 0.12, 2.02, 0.16, COL[1] - LY + 0.2, 0.12, PAL.steel);
			r.box(COL[0] - 0.08, COL[1] - 0.08, 2.02, LINE_X + 0.08 - COL[0] + 0.08, 0.16, 0.12, PAL.steel);
			const running = trayAt(P.lidding, n);
			r.cylinder(COL[0], COL[1], 2.14, 0.025, 0.08, PAL.dark, 6);
			[
				["#43c46b", "#2e4a37", running],
				["#f2b630", "#5a4a24", !running],
				["#e0473a", "#4f2a27", false],
			].forEach(([on, off, lit], i) => r.cylinder(COL[0], COL[1], 2.22 + i * 0.085, 0.055, 0.08, lit ? on : off, 8));
		},
	});
}

// ---------------------------------------------------------------------------
// Coder: a print-and-apply labeller behind the belt. It prints the label as the trays index, then a
// tamp pad on a slide carries it out over the lid and presses it on at PLACE.coder.

const CY = GATE.coder;
const SPOT = [LINE_X + 0.12, CY + 0.17]; // label position on the lid (food.js drawCode)
const PEEL_X = 10.62;
const PAD = { up: 1.28, touch: BZ + 0.21 };

function pad(n, u) {
	const w = work(u);
	if (!trayAt(P.coder, n)) return { x: PEEL_X, z: PAD.up, label: true, printing: false };
	const x = keys(
		[
			[0, PEEL_X],
			[0.35, SPOT[0]],
			[1.1, SPOT[0]],
			[1.5, PEEL_X],
		],
		w,
	);
	const z = keys(
		[
			[0.35, PAD.up],
			[0.72, PAD.touch + 0.015],
			[0.8, PAD.touch],
			[1.1, PAD.up],
		],
		w,
	);
	return { x, z, label: w < 0.8 && u > 0.9, printing: u > 0.15 && u < 0.95 };
}

export function buildCoder(scene, ctx, T) {
	const g = ctx.group;
	const [, sy] = SPOT;
	object(scene, 9.95, CY - 0.32, 10.6, CY + 0.42, 1.65, (r) => {
		r.box(9.94, CY - 0.14, 0, 0.28, 0.28, 0.03, PAL.steelDark);
		r.box(10.02, CY - 0.06, 0, 0.12, 0.12, 1.2, PAL.steel);
		r.box(9.98, CY - 0.3, 1.2, 0.54, 0.6, 0.42, HOUSING, { top: STEEL });
		r.quad(
			[
				[10.525, CY - 0.24, 1.42],
				[10.525, CY - 0.02, 1.42],
				[10.525, CY - 0.02, 1.56],
				[10.525, CY - 0.24, 1.56],
			],
			PAL.screen,
			{ flat: true },
		);
		r.box(10.52, sy - 0.08, 1.4, 0.08, 0.16, 0.03, PAL.steelDark); // peel edge
		// Label roll on the side of the printer.
		r.tube([10.25, CY + 0.3, 1.41], [10.25, CY + 0.38, 1.41], 0.16, "#f4f4f0", 12);
		r.tube([10.25, CY + 0.29, 1.41], [10.25, CY + 0.4, 1.41], 0.05, PAL.steelDark, 8);
	}, { group: g });
	object(scene, 10.52, sy - 0.06, 11.5, sy + 0.06, 1.62, (r) => r.box(10.52, sy - 0.05, 1.52, 0.98, 0.1, 0.08, STEEL), { group: g, depth: LINE_X + sy - 1 });
	const padX = () => {
		const { n, u } = clock(T(scene.time));
		return pad(n, u).x;
	};
	scene.addDynamic({
		group: g,
		depth: () => padX() + sy + 0.5,
		bounds: [10.4, CY - 0.3, BZ, 11.6, CY + 0.3, 1.7],
		animated: () => true,
		draw: (r, t0) => {
			const { n, u } = clock(T(t0));
			const p = pad(n, u);
			r.sphere(10.53, CY + 0.2, 1.56, 0.025, p.printing ? "#59b7ff" : PAL.screenOn, 0);
			r.box(p.x - 0.07, sy - 0.08, 1.46, 0.14, 0.16, 0.16, SERVO);
			r.box(p.x - 0.025, sy - 0.025, p.z + 0.03, 0.05, 0.05, 1.46 - p.z - 0.03, PAL.steel);
			if (p.label) r.box(p.x - 0.075, sy - 0.085, p.z - 0.006, 0.15, 0.17, 0.006, FOOD.label);
			r.box(p.x - 0.065, sy - 0.075, p.z, 0.13, 0.15, 0.03, PAL.dark);
		},
	});
}
