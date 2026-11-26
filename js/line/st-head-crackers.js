// Cracker station. Sealed packs only (cases are opened outside the cold room). Operator 1 lays packs
// printed side up on a short inclined infeed that reaches through the back guard opening; its
// keyed guides only take a pack that way up. The infeed tops up a keyed gravity magazine (a vertical
// chute fed from the top, emptied from the bottom) that stands beside the belt; a level sensor
// watches it. Each step an escapement gate lets the bottom pack drop onto the pick spot while a
// separator blade holds the rest of the stack. A fixed pick-and-place unit (an x axis, a z axis and
// a twist, one food-grade suction cup) takes it, turns it to the diagonal, comes straight down
// beside the standing slices with a slow last 10 mm, and lets go at PLACE.crackers.
// Drawing code only; no text.

import { CYCLE, clock, MOVE, PLACE } from "./clock.js";
import { lerp, object } from "./common.js";
import { drawPack, frame, SPOT } from "./food.js";
import { BELT_Z, HEADING, LINE_X, SLOT, slotY } from "./layout.js";
import { level } from "./schedule.js";
import { keyed, lamp, seg, sensorBox, SS, suctionCup } from "./st-head-parts.js";

const Y7 = slotY(SLOT.crackers);
const SPOT_AT = (() => {
	const p = frame(LINE_X, Y7, BELT_Z, HEADING, 1)(SPOT.crackers.f, SPOT.crackers.sd, 0.052);
	return { x: p[0], y: p[1], z: p[2], rot: HEADING + SPOT.crackers.rot };
})();
const PY = SPOT_AT.y; // the unit moves only in x and z, so everything sits on this line
const PH = 0.03; // pack thickness (drawn)
const ROT_PICK = HEADING; // packs lie along y in the magazine
const NX = 10.25; // pick spot (nest) beside the belt
const NZ = 0.98; // nest surface
const MX = 9.9; // magazine (chute) centre
const GZ = 1.05; // bottom pack rests on the escapement gate here
const CHUTE = 14; // packs the chute holds
const K = 38; // packs at a full load (Operator 1 refills about every 30 steps, one pack per step)
const IX0 = 5.85; // infeed loading end (just outside the back guard)
const IX1 = 9.84; // infeed discharge over the chute top
const IZ0 = 1.24;
const IZ1 = 1.57;
const IPITCH = 0.15;
const FRONT = 9.7; // the lead pack on the infeed
const izAt = (x) => lerp(IZ0, IZ1, (x - IX0) / (IX1 - IX0));
const COL = [9.5, PY + 0.3]; // pick-and-place column
const BEAM = { x0: 9.36, x1: 11.62, y: PY - 0.12, z: 2.0 };
const RELEASE = PLACE.crackers[0];
// Work-window timing.
const VAC_ON = -0.9;
const BLADE = [0.26, 0.6]; // separator blade holds the second pack
const GATE = [0.3, 0.46]; // escapement open
const FALL = [0.32, 0.45]; // bottom pack drops onto the slide
const SLIDE = [0.45, 0.8]; // and slides onto the pick spot
const LOWER = [0.6, 0.72]; // the stack settles onto the gate
const FEED = [0.75, 1.3]; // the infeed advances one pack into the chute top

/** Packs at step start (with a refill counted from the moment it happens). */
function packCount(t) {
	const { n } = clock(t);
	let L = level("crackers", n * CYCLE);
	if (level("crackers", t) > L + 0.05) L = Math.min(1, L + 0.8);
	return Math.max(2, Math.round(L * K));
}

export function buildCrackers(scene, ctx, T) {
	const g = ctx.group;
	const hw = 0.15;

	// Infeed: an inclined belt with keyed side guides, legs, and a flared loading lip at the guard.
	const xm = 7.85;
	for (const [a, b] of [
		[IX0, xm],
		[xm, IX1],
	]) {
		object(
			scene,
			a,
			PY - hw - 0.05,
			b,
			PY + hw + 0.05,
			IZ1 + 0.1,
			(r) => {
				for (const lx of [a + 0.35, b - 0.4]) r.box(lx, PY - 0.04, 0, 0.08, 0.08, izAt(lx) - 0.08, SS.dark);
				r.beam([a, PY, izAt(a) - 0.06], [b, PY, izAt(b) - 0.06], hw * 2, 0.08, SS.steel);
				r.quad(
					[
						[a, PY - hw + 0.03, izAt(a) - 0.015],
						[b, PY - hw + 0.03, izAt(b) - 0.015],
						[b, PY + hw - 0.03, izAt(b) - 0.015],
						[a, PY + hw - 0.03, izAt(a) - 0.015],
					],
					"#2f6fb3",
					{ flat: true },
				);
				// Keyed guides: the low lip on one side only lets a pack lie printed side up.
				r.beam([a, PY - 0.11, izAt(a) + 0.01], [b, PY - 0.11, izAt(b) + 0.01], 0.02, 0.06, SS.bright);
				r.beam([a, PY + 0.105, izAt(a) - 0.005], [b, PY + 0.105, izAt(b) - 0.005], 0.03, 0.03, SS.dark);
				r.beam([a, PY + 0.115, izAt(a) + 0.03], [b, PY + 0.115, izAt(b) + 0.03], 0.02, 0.05, SS.bright);
				if (a === IX0) {
					// Loading lip, flared toward the supply aisle.
					const z = izAt(IX0);
					r.quad(
						[
							[IX0 - 0.25, PY - 0.24, z + 0.06],
							[IX0, PY - 0.13, z],
							[IX0, PY + 0.13, z],
							[IX0 - 0.25, PY + 0.24, z + 0.06],
						],
						SS.bright,
						{ edge: "rgba(110,120,130,0.6)" },
					);
				}
			},
			{ group: g },
		);
	}

	// Pick spot (nest) on a pedestal, the slide from the chute bottom, the chute stand.
	object(
		scene,
		MX - 0.2,
		PY - 0.2,
		NX + 0.2,
		PY + 0.2,
		GZ,
		(r) => {
			for (const dy of [-0.16, 0.12]) r.box(MX - 0.03, PY + dy, 0, 0.06, 0.04, GZ - 0.06, SS.dark);
			r.box(NX - 0.04, PY - 0.04, 0, 0.08, 0.08, NZ - 0.03, SS.dark);
			r.quad(
				[
					[MX - 0.07, PY - 0.11, GZ - 0.055],
					[NX - 0.12, PY - 0.11, NZ],
					[NX - 0.12, PY + 0.11, NZ],
					[MX - 0.07, PY + 0.11, GZ - 0.055],
				],
				SS.bright,
				{ edge: "rgba(110,120,130,0.7)" },
			);
			r.box(NX - 0.12, PY - 0.12, NZ - 0.03, 0.26, 0.24, 0.03, SS.steel, { top: SS.bright });
			// End stop and side locators square the pack on the spot.
			r.box(NX + 0.1, PY - 0.1, NZ, 0.03, 0.2, 0.04, SS.dark);
		},
		{ group: g },
	);

	// Packs waiting on the infeed: each step the row advances one pack into the chute.
	scene.addDynamic({
		group: g,
		depth: (IX0 + FRONT) / 2 + PY,
		bounds: [IX0, PY - 0.2, 1.0, IX1, PY + 0.2, IZ1 + 0.1],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const w = clock(t).u - MOVE;
			const total = packCount(t);
			const onInfeed = Math.max(0, total - CHUTE);
			const adv = seg(w, FEED[0], FEED[1]) * IPITCH;
			for (let k = onInfeed - 1; k >= 1; k--) {
				const x = FRONT - k * IPITCH + adv;
				drawPack(r, x, PY, izAt(x), 1, ROT_PICK);
			}
			if (onInfeed > 0 && w < FEED[0]) drawPack(r, FRONT, PY, izAt(FRONT), 1, ROT_PICK);
		},
	});

	// The magazine: guide rails, the stack, separator blade, escapement gate, the pack dropping to the
	// pick spot, the pack waiting there, and the level sensor.
	scene.addDynamic({
		group: g,
		depth: MX + PY + 0.15,
		bounds: [MX - 0.2, PY - 0.2, 0.9, NX + 0.2, PY + 0.2, IZ1 + 0.1],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const w = clock(t).u - MOVE;
			const total = packCount(t);
			const c = Math.min(CHUTE, total);
			const refill = total > CHUTE;
			const top = GZ + CHUTE * PH + 0.05;
			const rail = (dx, dy) => r.box(MX + dx - 0.012, PY + dy - 0.012, GZ - 0.06, 0.024, 0.024, top - GZ + 0.06, SS.rod);
			// Back rails and the key strip.
			rail(-0.075, -0.1);
			rail(0.075, -0.1);
			rail(-0.075, 0.1);
			r.box(MX - 0.088, PY - 0.03, GZ - 0.04, 0.012, 0.06, top - GZ + 0.04, SS.dark);
			// The pack waiting on the pick spot (dropped last step, or this step once it has slid down).
			const dropped = w >= SLIDE[1];
			if (dropped || w < VAC_ON) drawPack(r, NX, PY, NZ, 1, ROT_PICK);
			// The bottom pack falling out of the gate and sliding onto the pick spot.
			if (w >= FALL[0] && w < SLIDE[1]) {
				let x = MX;
				let z = lerp(GZ, GZ - 0.05, seg(w, FALL[0], FALL[1]));
				if (w >= SLIDE[0]) {
					const k = seg(w, SLIDE[0], SLIDE[1]);
					x = lerp(MX, NX, k);
					z = lerp(GZ - 0.05, NZ, k);
				}
				drawPack(r, x, PY, z, 1, ROT_PICK);
			}
			// The stack: whole until the gate opens; then held by the blade one pack up, then set
			// down on the gate. The infeed's lead pack drops in on top.
			const gone = w >= FALL[0] ? 1 : 0;
			const zb = GZ + (gone ? PH * (1 - seg(w, LOWER[0], LOWER[1])) : 0);
			for (let i = 0; i < c - gone; i++) drawPack(r, MX, PY, zb + i * PH, 1, ROT_PICK);
			if (refill && w >= FEED[0]) {
				const k = seg(w, FEED[0], FEED[1]);
				const zEnd = GZ + (c - 1) * PH;
				const x = lerp(FRONT, MX, Math.min(1, k * 1.6));
				const z = k < 0.6 ? izAt(FRONT) + 0.01 : lerp(izAt(FRONT) + 0.01, zEnd, seg(k, 0.6, 1));
				drawPack(r, x, PY, Math.max(z, zEnd), 1, ROT_PICK);
			}
			// Separator blade (from the back) and the escapement gate fingers (at both ends).
			const blade = w >= BLADE[0] && w < BLADE[1] ? 1 : 0;
			r.box(MX - 0.14 + blade * 0.06, PY - 0.06, GZ + PH + 0.002, 0.08, 0.12, 0.008, SS.dark);
			const open = w >= GATE[0] && w < GATE[1] ? 1 : 0;
			for (const sg of [-1, 1]) r.box(MX - 0.04, PY + sg * (0.075 + open * 0.05) - 0.015, GZ - 0.016, 0.08, 0.03, 0.014, SS.dark);
			// Front rail and the level sensor: amber once the infeed is empty and the chute runs down.
			rail(0.075, 0.1);
			r.box(MX - 0.09, PY - 0.11, top - 0.02, 0.18, 0.22, 0.02, SS.steel);
			const lz = GZ + 5 * PH;
			sensorBox(r, MX + 0.12, PY + 0.02, lz, 0.07, 0.07, 0.06);
			lamp(r, MX + 0.155, PY + 0.02, lz + 0.1, total <= CHUTE + 2 ? "#f2a33a" : "#43c46b");
		},
	});

	// The pick-and-place unit: a column behind the belt, a cantilevered x axis over the belt, a
	// carriage with a z axis, a rotary (the twist), and one suction cup.
	scene.addDynamic({
		group: g,
		depth: LINE_X + Y7 + 0.5,
		bounds: [BEAM.x0 - 0.15, PY - 0.25, 0.85, BEAM.x1 + 0.05, COL[1] + 0.1, BEAM.z + 0.2],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const w = clock(t).u - MOVE;
			const S = SPOT_AT;
			const [x, zc, rot] = keyed(w, [
				[-1.5, [NX, 1.12, ROT_PICK]],
				[-1.25, [NX, 1.12, ROT_PICK]],
				[-1.0, [NX, NZ + PH, ROT_PICK]], // down onto the pack
				[VAC_ON, [NX, NZ + PH, ROT_PICK]], // vacuum on
				[-0.7, [NX, 1.15, ROT_PICK]],
				[0.1, [S.x, 1.25, S.rot]], // across, turning the pack to the diagonal
				[0.95, [S.x, S.z + PH + 0.025, S.rot]], // straight down beside the slices
				[RELEASE, [S.x, S.z + PH, S.rot]], // slow last 10 mm, vacuum off
				[RELEASE + 0.12, [S.x, S.z + PH, S.rot]],
				[1.7, [S.x, 1.2, S.rot]],
				[2.5, [NX, 1.12, ROT_PICK]],
			]);
			// Column and bracket.
			r.box(COL[0] - 0.07, COL[1] - 0.07, 0, 0.14, 0.14, BEAM.z + 0.16, SS.steel);
			r.box(COL[0] - 0.06, BEAM.y - 0.06, BEAM.z, 0.12, COL[1] - BEAM.y + 0.06, 0.14, SS.steel);
			// The x axis: a sealed stainless linear module with its motor at the back end.
			r.box(BEAM.x0, BEAM.y - 0.07, BEAM.z, BEAM.x1 - BEAM.x0, 0.14, 0.14, SS.steel, { top: SS.bright });
			r.box(BEAM.x0 - 0.12, BEAM.y - 0.06, BEAM.z + 0.01, 0.12, 0.12, 0.12, SS.dark);
			// Held pack, cup, twist, z rod and guide, carriage (bottom to top).
			if (w >= VAC_ON && w < RELEASE) drawPack(r, x, PY, zc - PH, 1, rot);
			suctionCup(r, x, PY, zc);
			r.cylinder(x, PY, zc + 0.075, 0.045, 0.06, SS.joint, 10);
			r.orientedBox(x + Math.cos(rot) * 0.04, PY + Math.sin(rot) * 0.04, zc + 0.085, 0.05, 0.02, 0.03, rot, SS.cup);
			const guide0 = 1.62;
			r.box(x - 0.016, PY - 0.016, zc + 0.135, 0.032, 0.032, guide0 - zc - 0.135, SS.rod);
			r.box(x - 0.045, PY - 0.045, guide0, 0.09, 0.09, BEAM.z - guide0 - 0.02, SS.steel);
			r.box(x - 0.12, BEAM.y - 0.1, BEAM.z - 0.03, 0.24, PY - BEAM.y + 0.15, 0.2, SS.bright);
		},
	});
}
