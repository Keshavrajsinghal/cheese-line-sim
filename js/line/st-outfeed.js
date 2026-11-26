// Outfeed: a gantry (a robot on overhead rails) spans the end of the conveyor and both cart slots.
// Its two jaws slide under the tray rim (never the lid), lift the plate, carry it gently, and set
// it into its cell in a 24-plate rack cart, then return. Each slot has floor guides, an end stop
// with a cart-present sensor, and a light curtain across its open front. Carts are drawn from the
// schedule: filling or full in a slot, pulled out to dispatch staging or pushed back in by
// Operator 2, parked full in staging, and the spare empty one waiting there. Drawing code only.

import { CYCLE, clock, GANTRY_LIFT, isReject1, isReject2, MOVE, P, work } from "./clock.js";
import { object, PAL } from "./common.js";
import { drawPlate, FULL } from "./food.js";
import { BELT_Z, CART_SLOTS, GATE, HEADING, LINE_X } from "./layout.js";
import { carts, DISPATCH_EMPTY, PER_CART, platesBy } from "./schedule.js";
import { BLUE, keys, SERVO, STEEL } from "./st-downstream-util.js";
import { CART, cellLocal, drawCart } from "./st-outfeed-cart.js";

const RX = [8.7, 13.1]; // gantry rails (x)
const RY = [44.5, 53.1]; // rail ends (y)
const POSTS_Y = [RY[0], (CART_SLOTS[0].y1 + CART_SLOTS[1].y0) / 2, RY[1]];
const RAIL_Z = 2.0; // rail bottom; rails are 0.12 tall
const BRIDGE_Z = 2.12;
const PICK = [LINE_X, GATE.outfeed];
const TRAVEL = 1.32; // carried tray bottom while travelling (clears the cart rails and the plates)
const SLOT_C = CART_SLOTS.map((s) => [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2]);
const CURTAIN_Z = [0.3, 0.48, 0.66, 0.84, 1.02, 1.2, 1.38, 1.56];

let memo = { t: Number.NaN, v: null };
/** carts(t), computed once per frame however many items ask. */
function cartsAt(t) {
	if (t !== memo.t) memo = { t, v: carts(t) };
	return memo.v;
}

/** Gantry pose: carriage over (x, y), held tray bottom tz, jaws 0 closed..1 open, hold. */
function gantryPose(t) {
	const { n, u } = clock(t);
	const w = work(u);
	const m = n - P.outfeed;
	const idle = { x: PICK[0], y: PICK[1], tz: TRAVEL, jaw: 1, hold: false };
	if (isReject1(m) || isReject2(m)) return idle;
	// Plate index j: how many plates were set down before this one (schedule.js plateTime).
	const j = platesBy((m + P.outfeed) * CYCLE + MOVE + GANTRY_LIFT + 2.6 - 0.01);
	const [sx, sy] = SLOT_C[Math.floor(j / PER_CART) % 2];
	const [a, c] = cellLocal(j % PER_CART);
	const cell = [sx + a, sy + c];
	const xy = keys(
		[
			[1.3, PICK],
			[3.0, cell],
			[3.7, cell],
			[5.6, PICK],
		],
		w,
	);
	const tz = keys(
		[
			[0, TRAVEL],
			[0.45, BELT_Z],
			[0.9, BELT_Z],
			[1.3, TRAVEL],
			[3.0, TRAVEL],
			[3.3, CART.deck + 0.02],
			[3.5, CART.deck], // slow last 20 mm; the cart shows the plate from plateTime
			[3.7, CART.deck],
			[4.0, TRAVEL],
		],
		w,
	);
	const jaw = keys(
		[
			[0.45, 1],
			[0.8, 0],
			[3.5, 0],
			[3.65, 1],
		],
		w,
	);
	return { x: xy[0], y: xy[1], tz, jaw, hold: w > GANTRY_LIFT && w < 3.5 };
}

/** One jaw: a plate down the tray's long side with a lip that slides under the rim. */
function jaw(r, x, y, tz, head, dir) {
	r.box(x - 0.015, y - 0.25, tz - 0.035, 0.03, 0.5, head - tz + 0.035, PAL.steel);
	r.box(dir > 0 ? x : x - 0.06, y - 0.22, tz - 0.035, 0.06, 0.44, 0.025, BLUE);
}

function buildGantry(scene, ctx, T) {
	const g = ctx.group;
	// Back posts and rail (behind everything in the cell), in short pieces for depth sorting.
	const pieces = 4;
	const len = (RY[1] - RY[0] + 0.14) / pieces;
	for (let i = 0; i < pieces; i++) {
		const y0 = RY[0] - 0.07 + i * len;
		const y1 = y0 + len;
		object(scene, RX[0] - 0.14, y0, RX[0] + 0.14, y1, RAIL_Z + 0.12, (r) => {
			for (const y of POSTS_Y)
				if (y >= y0 && y < y1 + 0.01) {
					r.box(RX[0] - 0.14, y - 0.14, 0, 0.28, 0.28, 0.03, PAL.steelDark);
					r.box(RX[0] - 0.07, y - 0.07, 0, 0.14, 0.14, RAIL_Z, PAL.steel);
				}
			r.box(RX[0] - 0.07, y0, RAIL_Z, 0.14, y1 - y0, 0.12, PAL.steel, { top: STEEL });
		}, { group: g });
	}
	// Front posts: in front of the carts, between the slots.
	for (const y of POSTS_Y)
		scene.add({
			group: g,
			live: true,
			depth: RX[1] + y + 0.2,
			bounds: [RX[1] - 0.15, y - 0.15, 0, RX[1] + 0.15, y + 0.15, RAIL_Z],
			draw: (r) => {
				r.box(RX[1] - 0.14, y - 0.14, 0, 0.28, 0.28, 0.03, PAL.steelDark);
				r.box(RX[1] - 0.07, y - 0.07, 0, 0.14, 0.14, RAIL_Z - 0.01, PAL.steel);
			},
		});
	scene.addDynamic({
		group: g,
		depth: () => {
			const p = gantryPose(T(scene.time));
			return p.x + p.y + 0.3;
		},
		bounds: [RX[0] - 0.3, RY[0] - 0.3, BELT_Z - 0.1, RX[1] + 0.3, RY[1] + 0.3, 2.45],
		animated: () => true,
		draw: (r, t0) => {
			const p = gantryPose(T(t0));
			const by = p.y;
			const head = p.tz + 0.3;
			r.box(RX[0] - 0.12, by - 0.2, RAIL_Z + 0.12, 0.24, 0.4, 0.1, SERVO);
			r.box(RX[0], by - 0.1, BRIDGE_Z, RX[1] - RX[0], 0.2, 0.14, STEEL);
			const jo = 0.25 + 0.08 * p.jaw;
			jaw(r, p.x - jo, by, p.tz, head, 1);
			if (p.hold) drawPlate(r, p.x, by, p.tz, HEADING, FULL, { noBadge: true });
			jaw(r, p.x + jo, by, p.tz, head, -1);
			r.box(p.x - 0.36, by - 0.2, head, 0.72, 0.4, 0.05, PAL.steelDark);
			for (const s of [-1, 1]) r.box(p.x + s * 0.27 - 0.07, by - 0.08, head + 0.05, 0.14, 0.16, 0.08, STEEL);
			r.box(p.x - 0.05, by - 0.05, head + 0.05, 0.1, 0.1, 1.98 - head - 0.05, PAL.steel);
			r.box(p.x - 0.17, by - 0.18, 1.98, 0.34, 0.36, 0.3, SERVO);
			r.cylinder(p.x - 0.06, by + 0.06, 2.28, 0.06, 0.08, PAL.dark, 8);
			r.box(RX[1] - 0.07, RY[0] - 0.07, RAIL_Z, 0.14, RY[1] - RY[0] + 0.14, 0.12, PAL.steel, { top: STEEL });
			r.box(RX[1] - 0.12, by - 0.2, RAIL_Z + 0.12, 0.24, 0.4, 0.1, SERVO);
		},
	});
}

// ---------------------------------------------------------------------------
// Cart slots: floor guides, an end stop with a cart-present sensor, and the light curtain.

const crossing = (s) => (s.phase === "leaving" || s.phase === "arriving") && s.pos && Math.abs(s.pos[0] - CART_SLOTS[0].curtain) < CART.bar + 0.1;

function buildSlots(scene, ctx, T) {
	const g = ctx.group;
	CART_SLOTS.forEach((s, i) => {
		const [cx, cy] = SLOT_C[i];
		const cu = s.curtain;
		object(scene, s.x0, s.y0, s.x1, s.y1, 0.1, (r) => {
			for (const dy of [-1.46, 1.4]) r.box(s.x0 + 0.1, cy + dy, 0, s.x1 - s.x0 - 0.1, 0.06, 0.05, PAL.steel);
		}, { group: g });
		// End stop and cart-present sensor (green while a cart is seated).
		scene.addDynamic({
			group: g,
			depth: cx + cy - 2.8,
			bounds: [s.x0 - 0.1, cy - 1.3, 0, s.x0 + 0.15, cy + 1.3, 0.5],
			animated: () => true,
			draw: (r, t0) => {
				const st = cartsAt(T(t0)).slots[i];
				const seated = st.phase === "filling" || st.phase === "full";
				r.box(s.x0 - 0.04, cy - 1.2, 0.08, 0.08, 2.4, 0.22, PAL.steel);
				r.box(s.x0 + 0.04, cy - 1.15, 0.1, 0.02, 2.3, 0.16, PAL.dark);
				r.box(s.x0 - 0.06, cy + 0.85, 0.3, 0.12, 0.12, 0.1, STEEL);
				r.sphere(s.x0 + 0.07, cy + 0.91, 0.36, 0.03, seated ? PAL.screenOn : "#4a5560", 0);
			},
		});
		// Light curtain: emitter post at the slot's far side, receiver post at its near side.
		scene.add({
			group: g,
			live: true,
			depth: cu + s.y0 + 0.05,
			bounds: [cu - 0.06, s.y0 - 0.06, 0, cu + 0.06, s.y0 + 0.06, 1.8],
			draw: (r) => {
				r.box(cu - 0.05, s.y0 - 0.05, 0, 0.1, 0.1, 1.72, PAL.safety);
				r.quad(
					[
						[cu - 0.03, s.y0 + 0.052, 0.22],
						[cu + 0.03, s.y0 + 0.052, 0.22],
						[cu + 0.03, s.y0 + 0.052, 1.62],
						[cu - 0.03, s.y0 + 0.052, 1.62],
					],
					PAL.dark,
					{ flat: true },
				);
			},
		});
		scene.addDynamic({
			group: g,
			depth: cu + s.y1 + 1.0,
			bounds: [cu - 0.1, s.y0 - 0.1, 0, cu + 0.1, s.y1 + 0.1, 1.9],
			animated: () => true,
			draw: (r, t0) => {
				const broken = crossing(cartsAt(T(t0)).slots[i]);
				if (!broken) for (const z of CURTAIN_Z) r.line([cu, s.y0 + 0.06, z], [cu, s.y1 - 0.06, z], "rgba(240,70,60,0.3)", 1);
				r.sphere(cu, s.y0, 1.78, 0.045, broken ? PAL.danger : PAL.screenOn, 0);
				r.box(cu - 0.05, s.y1 - 0.05, 0, 0.1, 0.1, 1.72, PAL.safety);
				r.sphere(cu, s.y1, 1.78, 0.045, broken ? PAL.danger : PAL.screenOn, 0);
			},
		});
	});
}

// ---------------------------------------------------------------------------
// Carts

/** Back and front items for one cart whose pose comes from pose(t): {x, y, ha, count, inSlot} or null. */
function addCart(scene, ctx, T, pose) {
	const g = ctx.group;
	const now = () => pose(T(scene.time));
	const bounds = () => {
		const p = now();
		if (!p) return [0, 0, -10, 0, 0, -10];
		const R = CART.bar + 0.1;
		return [p.x - R, p.y - R, 0, p.x + R, p.y + R, CART.barZ + 0.3];
	};
	for (const part of ["back", "front"])
		scene.addDynamic({
			group: g,
			depth: () => {
				const p = now();
				if (!p) return 0;
				return p.x + p.y + (part === "back" ? -2.6 : p.inSlot ? 2.6 : 0.9);
			},
			bounds,
			animated: () => true,
			draw: (r, t0) => {
				const p = pose(T(t0));
				if (p) drawCart(r, p.x, p.y, p.ha, p.count, part);
			},
		});
}

function buildCarts(scene, ctx, T) {
	CART_SLOTS.forEach((_, i) =>
		addCart(scene, ctx, T, (t) => {
			const s = cartsAt(t).slots[i];
			if (!s.pos) return null;
			const inSlot = s.phase === "filling" || s.phase === "full";
			// The push bar leads when Operator 2 pulls the cart, trails when they push it.
			const ha = s.phase === "arriving" ? s.heading + Math.PI : s.heading;
			return { x: s.pos[0], y: s.pos[1], ha, count: s.count, inSlot };
		}),
	);
	// A full cart parked in dispatch staging.
	addCart(scene, ctx, T, (t) => {
		const p = cartsAt(t).parked[0];
		return p ? { x: p.pos[0], y: p.pos[1], ha: p.heading ?? 0, count: PER_CART, inSlot: false } : null;
	});
	// The spare empty cart in dispatch staging; its push bar faces where Operator 2 takes hold.
	addCart(scene, ctx, T, (t) => {
		const c = cartsAt(t);
		if (!c.emptyWaiting) return null;
		const [ex, ey] = c.emptyPos ?? DISPATCH_EMPTY;
		return { x: ex, y: ey, ha: (c.emptyHeading ?? Math.PI / 2) + Math.PI, count: 0, inSlot: false };
	});
}

export function build(scene, ctx, T) {
	buildSlots(scene, ctx, T);
	buildCarts(scene, ctx, T);
	buildGantry(scene, ctx, T);
}
