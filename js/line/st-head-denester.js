// Tray denester (stainless, washdown) at the head of the indexing belt. A magazine holds a stack of
// nested molded fiber trays; four scroll (separator) screws under the stack turn once per step and
// peel off the bottom tray, which drops into the belt pocket at slot 0. A height sensor checks
// that only one tray is separating, a through-beam at slot 0 confirms a tray is present, and a
// level sensor on the magazine warns before it runs empty. Operator 1 loads new stacks from the
// head aisle onto the loading shelf that reaches through the head guard opening.
// Drawing code only; no text.

import { CYCLE, clock, MOVE } from "./clock.js";
import { lerp, object } from "./common.js";
import { drawTray, FOOD } from "./food.js";
import { BELT, BELT_Z, GUARD, HEADING, LINE_X, SLOT, slotY } from "./layout.js";
import { level } from "./schedule.js";
import { lamp, seg, sensorBox, SS } from "./st-head-parts.js";

const X = LINE_X;
const Y = slotY(SLOT.denester);
const TW = 0.46; // tray footprint across the belt (x)
const TL = 0.64; // along the belt (y)
const TH = 0.05; // tray height
const NEST = 0.0125; // nested pitch: each tray sits this much above the one below it
const K = 38; // trays in a full magazine: Operator 1 refills about every 30 steps, one tray per step
const Z0 = 1.1; // bottom of the stack, held by the screws (clear of a seated tray)
const PLATE_Z = 1.13; // separator plate (the screws hang from it)
const TOP = 1.7; // top ring of the magazine
const POST_X = 10.3; // C-frame posts behind the belt
const SCREWS = [
	[-0.27, -0.19],
	[-0.27, 0.19],
	[0.27, -0.19],
	[0.27, 0.19],
];
// Work-window timing (seconds into the work window).
const TURN = [0.15, 0.75]; // screws make one turn and release the bottom tray
const DROP = [0.75, 1.1]; // the tray falls into the pocket
const SEAT = [1.1, 1.7]; // the pocket squares it up
const SEEN = 1.75; // tray-present sensor confirms

/** Trays in the magazine during step n (includes the bottom one that drops this step). */
function stackCount(t) {
	const { n } = clock(t);
	let L = level("denester", n * CYCLE);
	// Refilled during this step: count the new stack from the moment it goes in.
	if (level("denester", t) > L + 0.05) L = Math.min(1, L + 0.8);
	return Math.max(3, Math.round(L * K));
}

function scrollScrew(r, x, y, z0, h, phase) {
	r.cylinder(x, y, z0, 0.032, h, SS.bright, 8);
	const pts = [];
	for (let i = 0; i <= 12; i++) {
		const a = phase + (i / 12) * Math.PI * 3;
		pts.push([x + Math.cos(a) * 0.036, y + Math.sin(a) * 0.036, z0 + (i / 12) * h]);
	}
	r.polyline(pts, "#56616c", 1.3);
	r.cylinder(x, y, z0 + h, 0.022, 0.04, SS.joint, 6);
}

/** The nested stack: a block with a flange line per tray, the top tray open. */
function trayStack(r, zb, count) {
	if (count <= 0) return;
	const h = TH + (count - 1) * NEST;
	const x0 = X - TW / 2;
	const y0 = Y - TL / 2;
	r.box(x0, y0, zb, TW, TL, h, "#a98b5d", { top: FOOD.trayIn });
	// Each tray's flange shows as a light rim, thinned out when zoomed out so the stack still reads.
	const step = Math.max(1, Math.ceil(2.6 / (NEST * 36 * r.zoom)));
	for (let i = count - 1; i >= 0; i -= step) {
		const z = zb + TH + i * NEST - 0.003;
		r.polyline(
			[
				[x0 - 0.005, y0 + TL + 0.005, z],
				[x0 + TW + 0.005, y0 + TL + 0.005, z],
				[x0 + TW + 0.005, y0 - 0.005, z],
			],
			"#e2cb9f",
			0.35,
		);
	}
	const zt = zb + h;
	r.polyline(
		[
			[x0 + 0.03, y0 + 0.03, zt + 0.001],
			[x0 + TW - 0.03, y0 + 0.03, zt + 0.001],
			[x0 + TW - 0.03, y0 + TL - 0.03, zt + 0.001],
			[x0 + 0.03, y0 + TL - 0.03, zt + 0.001],
		],
		"#a88c5f",
		1,
		true,
	);
}

export function buildDenester(scene, ctx, T) {
	const g = ctx.group;
	const ys = [Y - 0.5, Y + 0.5];
	// C-frame posts behind the belt and the loading shelf (both behind everything that moves).
	object(
		scene,
		POST_X - 0.1,
		GUARD.head - 0.2,
		X + 0.3,
		Y + 0.6,
		TOP,
		(r) => {
			// Loading shelf from the head guard opening to the magazine top, with side lips.
			const sy0 = GUARD.head - 0.15;
			const sy1 = Y - TL / 2 - 0.04;
			const zs = 1.62;
			r.box(POST_X - 0.04, sy0 + 0.1, zs - 0.12, 0.08, Y - 0.5 - sy0 - 0.1, 0.08, SS.dark); // arm from the post
			r.box(POST_X, sy0 + 0.1, zs - 0.1, X + 0.24 - POST_X, 0.07, 0.07, SS.dark); // cross member
			r.box(X - 0.28, sy0, zs, 0.56, sy1 - sy0, 0.03, SS.steel, { top: SS.bright });
			r.box(X - 0.29, sy0, zs, 0.03, sy1 - sy0, 0.08, SS.steel);
			r.box(X + 0.26, sy0, zs, 0.03, sy1 - sy0, 0.08, SS.steel);
			for (const y of ys) r.box(POST_X - 0.06, y - 0.06, 0, 0.12, 0.12, TOP, SS.steel);
			// Upper arms from the posts to the magazine top ring.
			for (const y of ys) r.box(POST_X, y - 0.035, TOP - 0.07, X - 0.25 - POST_X, 0.07, 0.07, SS.steel);
			// Back arms carrying the separator plate.
			for (const y of ys) r.box(POST_X, y - 0.04, PLATE_Z, X - 0.3 - POST_X, 0.08, 0.05, SS.steel);
		},
		{ group: g },
	);

	// Everything above the belt: separator plate, screws, the stack, the falling tray, sensors.
	scene.addDynamic({
		group: g,
		depth: X + Y + 0.6,
		bounds: [POST_X - 0.2, GUARD.head - 0.3, 0, BELT[1] + 0.3, Y + 0.7, TOP + 0.1],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const { u } = clock(t);
			const w = u - MOVE;
			const count = stackCount(t);
			const released = w >= TURN[1];
			const turn = w < 0 ? 0 : seg(w, TURN[0], TURN[1]);
			// The bottom tray: in the stack until released, then falling and seating in the pocket.
			let trayZ = Z0;
			let trayDx = 0;
			if (released) {
				const k = Math.min(1, (w - DROP[0]) / (DROP[1] - DROP[0]));
				trayZ = lerp(Z0, BELT_Z, k * k);
				trayDx = 0.025 * (1 - seg(w, SEAT[0], SEAT[1]));
			}
			const present = w >= SEEN;
			const x0 = X - TW / 2 - 0.08;
			const x1 = X + TW / 2 + 0.08;
			const y0 = Y - TL / 2 - 0.05;
			const y1 = Y + TL / 2 + 0.05;

			// Tray-present sensor: emitter behind the belt.
			const eyeY = Y + 0.2;
			const eyeZ = BELT_Z + 0.03;
			r.box(BELT[0] - 0.16, eyeY - 0.03, 0, 0.06, 0.06, eyeZ, SS.dark);
			sensorBox(r, BELT[0] - 0.13, eyeY, eyeZ - 0.02, 0.07, 0.07, 0.06);
			// Separator plate, back and left bars (behind the tray and the stack).
			r.box(X - 0.3 - 0.02, y0 - 0.05, PLATE_Z, 0.1, y1 - y0 + 0.1, 0.05, SS.steel);
			r.box(x0, y0 - 0.05, PLATE_Z, x1 - x0, 0.08, 0.05, SS.steel);
			// Screw drive: a gearbox on the back of the plate, a timing belt to the screws.
			r.box(X - 0.62, Y - 0.2, PLATE_Z + 0.05, 0.28, 0.4, 0.2, SS.steel, { top: SS.bright });
			r.cylinder(X - 0.48, Y, PLATE_Z + 0.25, 0.08, 0.14, SS.dark, 10);
			r.polyline(
				[
					[X - 0.34, Y - 0.19, PLATE_Z + 0.06],
					[X + 0.27, Y - 0.19, PLATE_Z + 0.06],
				],
				"#3b4048",
				1.4,
			);
			for (const [dx, dy] of SCREWS.slice(0, 2)) scrollScrew(r, X + dx, Y + dy, Z0 - 0.02, PLATE_Z - Z0 + 0.1, turn * Math.PI * 2);
			// Back guide rods.
			for (const dy of [-0.34, 0.34]) r.box(X - 0.27, Y + dy - 0.015, PLATE_Z + 0.05, 0.03, 0.03, TOP - PLATE_Z - 0.05, SS.rod);
			r.box(X - 0.28, Y - 0.36, TOP - 0.05, 0.05, 0.72, 0.05, SS.steel);
			r.box(X - 0.28, Y - 0.36, TOP - 0.05, 0.56, 0.05, 0.05, SS.steel);

			// The falling (or seated) tray, then the stack above it.
			if (released) drawTray(r, X + trayDx, Y, trayZ, HEADING);
			const inStack = released ? count - 1 : count;
			const stackZ = released ? Z0 + NEST * (1 - seg(w, TURN[1], TURN[1] + 0.3)) : Z0;
			trayStack(r, stackZ, inStack);

			// Height sensor (double-feed check) on the front of the plate, aimed across the gap the
			// separating tray passes through; it checks during the screw turn.
			const checking = w >= TURN[0] && w < TURN[1];
			if (checking) r.line([X + TW / 2 + 0.04, Y - 0.12, Z0 + 0.02], [X - TW / 2, Y - 0.12, Z0 + 0.02], "rgba(235,60,50,0.85)", 1.3);
			// Front screws, front and right bars of the plate.
			for (const [dx, dy] of SCREWS.slice(2)) scrollScrew(r, X + dx, Y + dy, Z0 - 0.02, PLATE_Z - Z0 + 0.1, -turn * Math.PI * 2);
			r.box(x0, y1 - 0.03, PLATE_Z, x1 - x0, 0.08, 0.05, SS.steel);
			r.box(x1 - 0.06, y0 - 0.05, PLATE_Z, 0.1, y1 - y0 + 0.1, 0.05, SS.steel);
			sensorBox(r, x1 + 0.0, Y - 0.12, PLATE_Z - 0.06, 0.08, 0.1, 0.07);
			lamp(r, x1 + 0.05, Y - 0.12, PLATE_Z + 0.04, checking ? "#f2c230" : "#43c46b");
			// Front guide rods and the top ring.
			for (const dy of [-0.34, 0.34]) r.box(X + 0.24, Y + dy - 0.015, PLATE_Z + 0.05, 0.03, 0.03, TOP - PLATE_Z - 0.05, SS.rod);
			r.box(X - 0.28, Y + 0.33, TOP - 0.05, 0.56, 0.05, 0.05, SS.steel);
			r.box(X + 0.23, Y - 0.36, TOP - 0.05, 0.05, 0.72, 0.05, SS.steel);
			// Level sensor on the front rod: amber once the stack runs low.
			const low = count < 12;
			const lz = Z0 + TH + 10 * NEST;
			sensorBox(r, X + 0.3, Y - 0.2, lz - 0.03, 0.07, 0.07, 0.06);
			lamp(r, X + 0.35, Y - 0.2, lz + 0.06, low ? "#f2a33a" : "#43c46b");

			// Tray-present receiver in front of the belt: the beam stops at the tray when one is seated.
			r.line([BELT[0] - 0.1, eyeY, eyeZ], [present ? X - TW / 2 : BELT[1] + 0.12, eyeY, eyeZ], "rgba(235,60,50,0.8)", 1.2);
			r.box(BELT[1] + 0.12, eyeY - 0.03, 0, 0.06, 0.06, eyeZ, SS.dark);
			sensorBox(r, BELT[1] + 0.15, eyeY, eyeZ - 0.02, 0.07, 0.07, 0.06);
			lamp(r, BELT[1] + 0.15, eyeY, eyeZ + 0.07, present ? "#43c46b" : "#3e5a46");
		},
	});
}
