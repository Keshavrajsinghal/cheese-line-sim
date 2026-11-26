// Grape station. Prep portions each bunch into its own pocket of a reusable blue tray (8 pockets per
// 600 x 400 mm tray). Two lanes run from the back guard to the robot:
//   lane A (full trays): reserve stack (loaded by Operator 1 through the back guard opening) ->
//     destacker (the active stack; releases one tray at a time) -> 3D camera hood (images the tray
//     once, multi-exposure, then the tray waits there) -> pick position under the delta robot;
//   lane B (empties): after 8 plates a pusher slides the empty tray sideways onto lane B, which
//     carries it back to a stacker beside the reserve, where Operator 1 collects the empties.
// The robot is a 4-axis washdown delta with two facing rows of soft silicone fingers: it lowers
// over the next pocket, closes the fingers across the bunch, turns it to lie along the plate and
// sets it flat at the plate's left end, releasing at PLACE.grapes. Drawing code only; no text.

import { CYCLE, clock, MOVE, PLACE } from "./clock.js";
import { lerp, object, PAL } from "./common.js";
import { drawBunch, frame, SPOT } from "./food.js";
import { BELT_Z, HEADING, LINE_X, SLOT, slotY } from "./layout.js";
import { level } from "./schedule.js";
import { fingerTool, hash, keyed, lamp, mod, rollerConveyor, seg, sensorBox, SS, washDelta } from "./st-head-parts.js";

const Y2 = slotY(SLOT.grapes);
const LA = 10.2; // lane A (full trays) centre, y
const LB = 11.42; // lane B (empties) centre, y
const HW = 0.6; // lane half-width
const LX0 = 6.06; // lanes start just inside the back guard
const LX1 = 10.45; // and end beside the tray belt
const CZ = BELT_Z; // lane surface height
const PT = { lx: 0.76, ly: 1.12, h: 0.08 }; // pocket tray footprint (x, y) and height (drawn at the food scale)
const RX = 6.5; // reserve stack (lane A)
const AX = 7.42; // destacker (active stack)
const CX = 8.55; // camera: the imaged tray waits here
const PX = 10.0; // pick position under the robot
const SX = 6.5; // stacker for empties (lane B)
// Pockets: 2 across (x) by 4 along (y), each holding one bunch lying along x. Picked nearest the
// plate first.
const POCKETS = [0.14, 0.42, -0.14, -0.42].flatMap((dy) => [0.19, -0.19].map((dx) => [dx, dy]));
const POCKET = [0.34, 0.25]; // pocket opening (x, y)
const FLOOR = 0.03; // pocket floor above the tray bottom

// Robot: delta hanging from a stainless portal frame.
const D = [10.52, 10.24];
const TOPZ = 2.72;
const DS = 1.35;
const TOOL = 0.3; // platform underside above the held bunch's base
const FRAME = { x0: 9.35, x1: 12.3, y0: 9.4, y1: 12.15 };
const PLACE_T = PLACE.grapes[0];
const PLACE_AT = (() => {
	const p = frame(LINE_X, Y2, BELT_Z, HEADING, 1)(SPOT.grapes.f, SPOT.grapes.sd, 0.052);
	return { x: p[0], y: p[1], z: p[2], ang: HEADING + SPOT.grapes.rot };
})();

// Pocket tray swap (every 8 plates), in seconds into the work window of the step that empties a
// tray. It hides in the time the robot is away at the plate.
const E_OUT = [0.3, 1.2]; // pusher slides the empty tray onto lane B
const E_BACK = [1.2, 1.7]; // pusher retracts
const E_IN = [1.0, 2.6]; // the imaged tray slides from the camera to the pick position
const E_LIFT = [2.6, 3.0]; // destacker forks lift the stack off its bottom tray
const E_GO = [3.0, 4.0]; // the bottom tray rides to the camera
const E_DOWN = [4.0, 4.4]; // the stack is set back down
const E_IMG = [4.45, 5.15]; // three exposures
const E_RET = [1.3, 4.3]; // lane B carries the empty to the stacker
const E_STK = [4.3, 4.8]; // the stacker lifts it into the stack of empties
const GRIP = [-1.1, -0.5]; // fingers come down over the bunch, then close

// ---------------------------------------------------------------------------
// Line state: which pocket tray is where, which pockets still hold a bunch.

function state(t) {
	const { n, u } = clock(t);
	const w = u - MOVE;
	const s = mod(n - 2, 8); // pocket used this step (tray m = n - 2 gets pocket m mod 8)
	const q = Math.floor((n - 2) / 8); // pocket tray at the pick position
	const swap = s === 7;
	const st = { n, w, s, q, swap, pick: null, empty: null, wait: null, rel: null };
	if (swap && w >= E_IN[0]) st.pick = { x: lerp(CX, PX, seg(w, E_IN[0], E_IN[1])), q: q + 1, from: 0 };
	else if (!(swap && w >= E_OUT[0])) st.pick = { x: PX, q, from: w >= GRIP[0] ? s + 1 : s };
	if (swap && w >= E_OUT[0] && w < E_RET[1]) st.empty = { x: lerp(PX, SX, seg(w, E_RET[0], E_RET[1])), y: lerp(LA, LB, seg(w, E_OUT[0], E_OUT[1])) };
	if (!swap || w < E_IN[0]) st.wait = { x: CX, q: q + 1 };
	else if (w >= E_GO[1]) st.wait = { x: CX, q: q + 2 };
	if (swap && w >= E_GO[0] && w < E_GO[1]) st.rel = { x: lerp(AX, CX, seg(w, E_GO[0], E_GO[1])), q: q + 2 };
	st.released = swap && w >= E_GO[0];
	st.lift = swap && w >= E_LIFT[0] ? (w < E_DOWN[0] ? seg(w, E_LIFT[0], E_LIFT[1]) : 1 - seg(w, E_DOWN[0], E_DOWN[1])) : 0;
	st.pusher = swap && w >= E_OUT[0] ? (w < E_OUT[1] ? seg(w, E_OUT[0], E_OUT[1]) : 1 - seg(w, E_BACK[0], E_BACK[1])) : 0;
	st.stk = swap && w >= E_STK[0] ? seg(w, E_STK[0], E_STK[1]) : -1;
	st.flash = swap && w >= E_IMG[0] && w < E_IMG[1] && (w - E_IMG[0]) % 0.25 < 0.09;
	return st;
}

/**
 * Stacks in the destacker and stacker, following the feeder level: Operator 1 loads a stack of 12
 * into the reserve position; the active stack shrinks; the reserve slides in when it empties.
 * Sampled once per step so trays do not vanish mid-step.
 */
function stacks(t) {
	const { n } = clock(t);
	const ts = n * CYCLE;
	const Ls = level("grapes", ts);
	const loaded = level("grapes", t) > Ls + 0.05;
	const a = 4 + ((Ls - 0.2) / 0.8) * 12; // full trays in the destacker (4..16)
	const reserve = a > 12.5 || loaded ? 12 : 0;
	const active = Math.max(1, a > 12.5 ? Math.round(a - 12) : Math.round(Math.min(a, 12)));
	// Empties: what has come back since the last load; Operator 1 takes them during the collect.
	const collected = level("grapes", t - 0.75) > Ls + 0.05;
	const empties = collected ? 0 : Math.max(0, Math.min(12, Math.round(((1 - Ls) / 0.8) * 12)));
	return { reserve, active, empties, low: reserve === 0 && active <= 5 };
}

/** Where pocket j of tray q lies when the tray is centred at (x0, LA): bunch base and angle. */
function pocketBunch(q, j, x0, y0 = LA, z0 = CZ) {
	const [dx, dy] = POCKETS[j];
	return { x: x0 + dx + (hash(q, j) - 0.5) * 0.03, y: y0 + dy + (hash(j + 3, q) - 0.5) * 0.03, z: z0 + FLOOR, ang: Math.PI + (hash(q + 0.37, j) - 0.5) * 0.6 };
}

// ---------------------------------------------------------------------------
// Drawing pieces

const BLUE_TOP = "#5c9fd0";
const POCKET_C = "#33729f";

/** One pocket tray at (cx, cy, z); bunches drawn for pockets j >= from (full detail). */
function pocketTray(r, cx, cy, z, q, from = 8) {
	r.box(cx - PT.lx / 2, cy - PT.ly / 2, z, PT.lx, PT.ly, PT.h, PAL.pocketTray, { top: BLUE_TOP });
	const zt = z + PT.h + 0.001;
	for (const [dx, dy] of POCKETS) {
		const px = cx + dx;
		const py = cy + dy;
		r.quad(
			[
				[px - POCKET[0] / 2, py - POCKET[1] / 2, zt],
				[px + POCKET[0] / 2, py - POCKET[1] / 2, zt],
				[px + POCKET[0] / 2, py + POCKET[1] / 2, zt],
				[px - POCKET[0] / 2, py + POCKET[1] / 2, zt],
			],
			POCKET_C,
			{ flat: true },
		);
	}
	if (from >= 8) return;
	const list = [];
	for (let j = from; j < 8; j++) list.push(pocketBunch(q, j, cx, cy, z));
	list.sort((a, b) => a.x + a.y - (b.x + b.y));
	for (const b of list) drawBunch(r, b.x, b.y, b.z, 1, b.ang);
}

/** A stack of pocket trays (bottom at z): one block with a seam per tray; full trays show bunches on top. */
function trayStack(r, cx, cy, z, count, full) {
	if (count <= 0) return;
	const x0 = cx - PT.lx / 2;
	const y0 = cy - PT.ly / 2;
	const h = count * PT.h;
	r.box(x0, y0, z, PT.lx, PT.ly, h, PAL.pocketTray, { top: BLUE_TOP });
	for (let i = 1; i < count; i++) {
		const zz = z + i * PT.h;
		r.polyline(
			[
				[x0, y0 + PT.ly, zz],
				[x0 + PT.lx, y0 + PT.ly, zz],
				[x0 + PT.lx, y0, zz],
			],
			full ? "#4f2f6a" : "#2c5f86",
			full ? 1.6 : 1,
		);
	}
	const zt = z + h + 0.001;
	for (const [dx, dy] of POCKETS) {
		const px = cx + dx;
		const py = cy + dy;
		r.quad(
			[
				[px - POCKET[0] / 2, py - POCKET[1] / 2, zt],
				[px + POCKET[0] / 2, py - POCKET[1] / 2, zt],
				[px + POCKET[0] / 2, py + POCKET[1] / 2, zt],
				[px - POCKET[0] / 2, py + POCKET[1] / 2, zt],
			],
			POCKET_C,
			{ flat: true },
		);
		if (full) {
			// The top tray's bunches, simplified (they read as purple at this distance).
			const blob = Array.from({ length: 7 }, (_, i) => {
				const a = (i / 7) * Math.PI * 2;
				return [px + Math.cos(a) * 0.12 * (i === 0 ? 0.75 : 1), py + Math.sin(a) * 0.075, zt + 0.03];
			});
			r.quad(blob, "#6f3f8f", { edge: "rgba(60,30,80,0.6)" });
		}
	}
}

/** Four corner posts of a stack frame (destacker or stacker); `which` selects back or front pair. */
function framePosts(r, cx, cy, which, h = 2.0) {
	const xs = [cx - PT.lx / 2 - 0.08, cx + PT.lx / 2 + 0.02];
	const ys = [cy - PT.ly / 2 - 0.08, cy + PT.ly / 2 + 0.02];
	const posts = which === "back" ? [[xs[0], ys[0]], [xs[1], ys[0]], [xs[0], ys[1]]] : [[xs[1], ys[1]]];
	for (const [x, y] of posts) r.box(x, y, 0, 0.06, 0.06, h, SS.steel);
	if (which === "back") {
		r.box(xs[0], ys[0], h - 0.06, xs[1] - xs[0] + 0.06, 0.06, 0.06, SS.steel);
		r.box(xs[0], ys[0], h - 0.06, 0.06, ys[1] - ys[0] + 0.06, 0.06, SS.steel);
	} else {
		r.box(xs[0], ys[1], h - 0.06, xs[1] - xs[0] + 0.06, 0.06, 0.06, SS.steel);
		r.box(xs[1], ys[0], h - 0.06, 0.06, ys[1] - ys[0] + 0.06, 0.06, SS.steel);
	}
}

// ---------------------------------------------------------------------------

export function buildGrapes(scene, ctx, T) {
	const g = ctx.group;

	// Lanes A and B (roller conveyors), the pusher body behind lane A, the robot frame's back posts
	// and beams. Split in pieces about 2 m long.
	const xm = (LX0 + LX1) / 2;
	for (const [a, b] of [
		[LX0, xm],
		[xm, LX1],
	]) {
		object(scene, a, LA - HW, b, LA + HW, CZ, (r) => rollerConveyor(r, a, b, LA, HW, CZ), { group: g });
		object(scene, a, LB - HW, b, LB + HW, CZ, (r) => rollerConveyor(r, a, b, LB, HW, CZ), { group: g });
	}
	object(
		scene,
		FRAME.x0 - 0.1,
		FRAME.y0 - 0.5,
		PX + 0.5,
		FRAME.y0 + 0.1,
		TOPZ + 0.12,
		(r) => {
			// Pusher: an air cylinder on a stand behind lane A, square to the pick position.
			r.box(PX - 0.05, LA - HW - 0.36, 0, 0.1, 0.1, CZ + 0.05, SS.dark);
			r.box(PX - 0.07, LA - HW - 0.4, CZ + 0.05, 0.14, 0.32, 0.12, SS.steel, { top: SS.bright });
			// Robot frame: back posts and the back beam.
			r.box(FRAME.x0 - 0.06, FRAME.y0 - 0.06, 0, 0.12, 0.12, TOPZ + 0.12, SS.steel);
			r.box(FRAME.x0 - 0.06, FRAME.y0 - 0.06, TOPZ, FRAME.x1 - FRAME.x0 + 0.12, 0.12, 0.12, SS.steel);
		},
		{ group: g },
	);
	object(scene, FRAME.x0 - 0.1, FRAME.y0, FRAME.x0 + 0.1, FRAME.y1 + 0.1, TOPZ + 0.12, (r) => {
		r.box(FRAME.x0 - 0.06, FRAME.y1 - 0.06, 0, 0.12, 0.12, TOPZ + 0.12, SS.steel);
		r.box(FRAME.x0 - 0.06, FRAME.y0 - 0.06, TOPZ, 0.12, FRAME.y1 - FRAME.y0 + 0.12, 0.12, SS.steel);
	}, { group: g });
	object(scene, FRAME.x1 - 0.1, FRAME.y0 - 0.1, FRAME.x1 + 0.1, FRAME.y0 + 0.1, TOPZ + 0.12, (r) => r.box(FRAME.x1 - 0.06, FRAME.y0 - 0.06, 0, 0.12, 0.12, TOPZ + 0.12, SS.steel), { group: g });
	// Front beams and the front-left post: in front of the robot, so drawn with the moving parts.
	scene.add({
		group: g,
		live: true,
		depth: FRAME.x1 + FRAME.y1 - 0.5,
		bounds: [FRAME.x0 - 0.1, FRAME.y0 - 0.1, 0, FRAME.x1 + 0.1, FRAME.y1 + 0.1, TOPZ + 0.12],
		draw: (r) => {
			r.box(FRAME.x1 - 0.06, FRAME.y0 - 0.06, TOPZ, 0.12, FRAME.y1 - FRAME.y0 + 0.12, 0.12, SS.steel);
			r.box(FRAME.x0 - 0.06, FRAME.y1 - 0.06, TOPZ, FRAME.x1 - FRAME.x0 + 0.12, 0.12, 0.12, SS.steel);
			r.box(FRAME.x1 - 0.06, FRAME.y1 - 0.06, 0, 0.12, 0.12, TOPZ + 0.12, SS.steel);
		},
	});

	// Reserve stack and destacker (lane A), with the tray the destacker is releasing.
	scene.addDynamic({
		group: g,
		depth: AX + LA,
		bounds: [LX0, LA - HW - 0.1, 0, CX + 0.5, LA + HW + 0.1, 2.1],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const st = state(t);
			const sk = stacks(t);
			// Reserve: side guides and the stack Operator 1 loaded through the opening.
			r.box(RX - 0.44, LA - PT.ly / 2 - 0.06, CZ, 0.88, 0.04, 0.12, SS.steel);
			trayStack(r, RX, LA, CZ, sk.reserve, true);
			r.box(RX - 0.44, LA + PT.ly / 2 + 0.02, CZ, 0.88, 0.04, 0.12, SS.steel);
			// Destacker: back posts, the stack (lifted by the forks while the bottom tray leaves),
			// the released tray, then the front post.
			framePosts(r, AX, LA, "back");
			// Before the release the bottom tray sits on the rollers and the forks lift the rest of
			// the stack 5 cm; after it leaves, the forks set the stack down on the rollers.
			const gap = 0.05 * st.lift;
			if (st.rel) pocketTray(r, st.rel.x, LA, CZ, st.rel.q, 0);
			let stackZ = CZ + PT.h + gap;
			if (st.released) stackZ = CZ + (PT.h + 0.05) * st.lift;
			else pocketTray(r, AX, LA, CZ, st.q + 2, 8);
			trayStack(r, AX, LA, stackZ, sk.active - 1, true);
			// Separator forks along both long sides, under the second tray.
			const fz = stackZ - 0.035;
			const reach = st.lift > 0 ? 0.04 : 0;
			r.box(AX - 0.3, LA - PT.ly / 2 - 0.06 + reach, fz, 0.6, 0.05, 0.03, SS.dark);
			r.box(AX - 0.3, LA + PT.ly / 2 + 0.01 - reach, fz, 0.6, 0.05, 0.03, SS.dark);
			framePosts(r, AX, LA, "front");
			// Level sensor on the front post: amber when the trays run low.
			sensorBox(r, AX + PT.lx / 2 + 0.09, LA + PT.ly / 2 + 0.05, CZ + 0.28, 0.07, 0.07, 0.06);
			lamp(r, AX + PT.lx / 2 + 0.13, LA + PT.ly / 2 + 0.05, CZ + 0.38, sk.low ? "#f2a33a" : "#43c46b");
		},
	});

	// Stacker for empties (lane B): the arriving tray is lifted in under the stack.
	scene.addDynamic({
		group: g,
		depth: SX + LB + 0.05,
		bounds: [LX0, LB - HW - 0.1, 0, SX + 0.6, LB + HW + 0.1, 2.1],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const st = state(t);
			const sk = stacks(t);
			framePosts(r, SX, LB, "back");
			const rise = st.stk >= 0 ? st.stk : 0;
			if (st.stk >= 0) pocketTray(r, SX, LB, CZ + rise * (PT.h + 0.01), 0);
			const count = sk.empties;
			trayStack(r, SX, LB, CZ + PT.h + 0.01 + rise * PT.h, count, false);
			// Latches that hold the stack.
			for (const y of [LB - PT.ly / 2 - 0.05, LB + PT.ly / 2 + 0.01]) r.box(SX - 0.2, y, CZ + PT.h + 0.0, 0.4, 0.04, 0.03, SS.dark);
			framePosts(r, SX, LB, "front");
		},
	});

	// The empty tray on its way back along lane B (pushed off the pick position, then conveyed).
	scene.addDynamic({
		group: g,
		depth: () => {
			const e = state(T(scene.time)).empty;
			return e ? e.x + e.y : 0;
		},
		bounds: [SX, LA - HW, CZ, LX1, LB + HW, CZ + 0.2],
		animated: () => true,
		draw: (r, t0) => {
			const e = state(T(t0)).empty;
			if (e && !(e.x <= SX + 0.001)) pocketTray(r, e.x, e.y, CZ, 0);
		},
	});

	// 3D camera hood over lane A (cantilevered from behind), with the imaged tray waiting under it.
	const hy0 = LA - HW - 0.12;
	scene.addDynamic({
		group: g,
		depth: CX + LA + 0.7,
		bounds: [CX - 0.5, hy0 - 0.1, 0, CX + 0.5, LA + HW, 1.9],
		animated: () => true,
		draw: (r, t0) => {
			const st = state(T(t0));
			// Two posts behind lane A carry the hood over it; the tray travels in and out along x.
			for (const x of [CX - 0.47, CX + 0.41]) r.box(x, hy0, 0, 0.06, 0.06, 1.64, SS.steel);
			if (st.wait) pocketTray(r, st.wait.x, LA, CZ, st.wait.q, 0);
			const z0 = 1.42;
			const hy1 = LA + 0.62;
			const glow = st.flash;
			// Exposure flash on the tray.
			if (glow) {
				r.quad(
					[
						[CX - PT.lx / 2, LA - PT.ly / 2, CZ + PT.h + 0.12],
						[CX + PT.lx / 2, LA - PT.ly / 2, CZ + PT.h + 0.12],
						[CX + PT.lx / 2, LA + PT.ly / 2, CZ + PT.h + 0.12],
						[CX - PT.lx / 2, LA + PT.ly / 2, CZ + PT.h + 0.12],
					],
					"#fffde8",
					{ alpha: 0.35, flat: true },
				);
			}
			r.box(CX - 0.47, hy0, z0, 0.94, 0.06, 0.16, SS.steel); // back skirt
			// The camera (projector between two lenses) and a light bar along each side.
			r.box(CX - 0.16, LA - 0.14, z0 - 0.08, 0.32, 0.28, 0.2, SS.sensor);
			for (const dx of [-0.1, 0.1]) r.cylinder(CX + dx, LA, z0 - 0.12, 0.035, 0.05, "#11151a", 8);
			for (const y of [LA - 0.48, LA + 0.42]) r.box(CX - 0.4, y, z0 + 0.04, 0.8, 0.06, 0.05, glow ? "#fffbe6" : "#e9eef2");
			r.box(CX - 0.47, hy0, z0 + 0.16, 0.94, hy1 - hy0, 0.06, SS.dark, { top: "#a3adb8" }); // top
			r.box(CX - 0.47, hy1 - 0.06, z0, 0.94, 0.06, 0.16, SS.steel); // front skirt
		},
	});

	// The tray at the pick position (or sliding into it), the pusher plate, and the end stop.
	scene.addDynamic({
		group: g,
		depth: () => {
			const p = state(T(scene.time)).pick;
			return (p ? p.x : PX) + LA;
		},
		bounds: [CX - 0.5, LA - HW - 0.5, CZ, LX1 + 0.1, LB, CZ + 0.4],
		animated: () => true,
		draw: (r, t0) => {
			const st = state(T(t0));
			// Pusher plate (it shoves the empty tray across onto lane B).
			const py = LA - PT.ly / 2 - 0.06 + st.pusher * (LB - LA);
			r.line([PX, LA - HW - 0.1, CZ + 0.1], [PX, py, CZ + 0.1], SS.rod, 3);
			r.box(PX - 0.3, py - 0.04, CZ + 0.02, 0.6, 0.04, 0.12, SS.bright);
			if (st.pick) pocketTray(r, st.pick.x, LA, CZ, st.pick.q, st.pick.from);
			r.box(PX + PT.lx / 2 + 0.02, LA - 0.3, CZ, 0.05, 0.6, 0.1, SS.dark);
		},
	});

	// The delta robot: hover over the next pocket, close the fingers across the bunch, lift, turn
	// it to lie along the plate, set it down flat and let go at PLACE.grapes.
	scene.addDynamic({
		group: g,
		depth: LINE_X + Y2 + 0.4,
		bounds: [FRAME.x0, FRAME.y0, 0.8, FRAME.x1, FRAME.y1, TOPZ + 0.15],
		animated: () => true,
		draw: (r, t0) => {
			const t = T(t0);
			const { n, u } = clock(t);
			const w = u - MOVE;
			const pocketOf = (k) => pocketBunch(Math.floor((k - 2) / 8), mod(k - 2, 8), PX);
			const cur = pocketOf(n);
			const nxt = pocketOf(n + 1);
			const P = PLACE_AT;
			const H = 1.22;
			const [x, y, z, open, ang] = keyed(w, [
				[-1.5, [cur.x, cur.y, cur.z + 0.24, 1, cur.ang]],
				[GRIP[0], [cur.x, cur.y, cur.z + 0.05, 1, cur.ang]],
				[-0.8, [cur.x, cur.y, cur.z, 1, cur.ang]], // slow last 20 mm
				[GRIP[1], [cur.x, cur.y, cur.z, 0, cur.ang]], // fingers close
				[-0.3, [cur.x, cur.y, cur.z + 0.05, 0, cur.ang]],
				[0.1, [cur.x, cur.y, H, 0, cur.ang]],
				[1.0, [P.x, P.y, H, 0, P.ang]], // gentle carry, turning to lie along the plate
				[1.45, [P.x, P.y, P.z + 0.05, 0, P.ang]],
				[1.85, [P.x, P.y, P.z, 0, P.ang]], // gentle set-down
				[PLACE_T, [P.x, P.y, P.z, 0, P.ang]],
				[PLACE_T + 0.25, [P.x, P.y, P.z, 1, P.ang]], // fingers open
				[PLACE_T + 0.45, [P.x, P.y, P.z + 0.05, 1, P.ang]], // finger clearance
				[2.9, [P.x, P.y, H, 1, P.ang]],
				[3.9, [nxt.x, nxt.y, nxt.z + 0.24, 1, nxt.ang]],
			]);
			const plat = [x, y, z + TOOL];
			// The delta hangs from a cross beam between the side beams of the frame.
			washDelta(r, D[0], D[1], TOPZ, plat, DS);
			r.box(D[0] - 0.07, FRAME.y0, TOPZ, 0.14, FRAME.y1 - FRAME.y0, 0.12, SS.steel, { top: SS.bright });
			let held = null;
			if (w >= GRIP[0] && w < GRIP[1]) held = () => drawBunch(r, cur.x, cur.y, cur.z, 1, cur.ang);
			else if (w >= GRIP[1] && w < PLACE_T) held = () => drawBunch(r, x, y, z, 1, ang);
			fingerTool(r, x, y, z, ang, open, plat[2], held);
		},
	});
}
