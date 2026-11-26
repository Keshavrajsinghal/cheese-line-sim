// What the people do, and when, as pure functions of time, so every drawing agrees: a feeder's
// level jumps up exactly when Operator 1 loads it, a cart leaves its slot exactly when Operator 2
// pulls it out, and a reject waits on its rework table until Operator 2 picks it up.
// Animation pacing is compressed (Operator 1 works through every refill point in a few minutes,
// not the design's 29-75 minute intervals); nothing here is shown as text.

import { CYCLE, GANTRY_LIFT, isReject1, isReject2, MOVE, P } from "./clock.js";
import { CART_SLOTS, DISPATCH, POSTS, REENTRY, REFILL, REWORK, STAGING } from "./layout.js";

const WALK = 1.25; // m/s
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const angle = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

/** A timeline of segments {t0, t1, from, to, kind, ...}; pose() interpolates position and facing. */
function poseOf(seg, t) {
	const k = seg.t1 > seg.t0 ? Math.min(1, Math.max(0, (t - seg.t0) / (seg.t1 - seg.t0))) : 1;
	const moving = seg.kind === "walk" || seg.kind === "push";
	const p = moving ? lerp2(seg.from, seg.to, k) : seg.to;
	const facing = moving && dist(seg.from, seg.to) > 0.01 ? angle(seg.from, seg.to) : (seg.facing ?? 0);
	return { x: p[0], y: p[1], facing, kind: seg.kind, k, walk: moving ? ((t - seg.t0) * WALK) / 1.1 : undefined, carry: seg.carry ?? null, task: seg.task ?? null };
}

function find(segs, t) {
	let lo = 0;
	let hi = segs.length - 1;
	if (t <= segs[0].t0) return segs[0];
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (segs[mid].t0 <= t) lo = mid;
		else hi = mid - 1;
	}
	return segs[lo];
}

// ---------------------------------------------------------------------------
// Operator 1: a fixed loop through every refill point on the supply aisle.

/** Staging bay (pick-up point) for each kind of stock, beside the supply aisle. */
const PICKUP_X = STAGING.x1 + 0.7;
export const BAYS = { trays: 7.9, pocket: 11.1, apples: 14.3, packs: 17.5, cheese: 20.7, cheese2: 23.9, empties: 27.1, lids: 37.7 };

/** Refill points in Operator 1's loop: what they carry there, and whether they take empties back. */
export const FEEDERS = [
	{ id: "grapes", stock: "pocket", empties: true },
	{ id: "apples", stock: "apples" },
	{ id: "crackers", stock: "packs" },
	{ id: "cheese-1", stock: "cheese", empties: true },
	{ id: "cheese-2", stock: "cheese", empties: true },
	{ id: "lids", stock: "lids" },
	{ id: "cheese-3", stock: "cheese2", empties: true },
	{ id: "cheese-4", stock: "cheese2", empties: true },
	{ id: "denester", stock: "trays" },
];

const HEAD_CORNER = [4.3, 4.0];

function buildOp1() {
	const segs = [];
	let t = 0;
	let at = POSTS["operator-1"];
	const step = (to, carry) => {
		const d = dist(at, to);
		if (d > 0.01) segs.push({ t0: t, t1: t + d / WALK, from: at, to, kind: "walk", carry });
		t += d / WALK;
		at = to;
	};
	// The supply aisle is an L: the back aisle (x < 5.6) and the head aisle (y < 5.2). Walks between
	// them go round the inside corner, never across the guarded head of the line.
	const inHead = (p) => p[1] < 5.4 && p[0] > 5.6;
	const walkTo = (to, carry) => {
		if (inHead(at) !== inHead(to)) step(HEAD_CORNER, carry);
		step(to, carry);
	};
	const act = (kind, dur, facing, extra = {}) => {
		segs.push({ t0: t, t1: t + dur, from: at, to: at, kind, facing, ...extra });
		t += dur;
	};
	const loads = {};
	for (const f of FEEDERS) {
		const bay = [PICKUP_X, BAYS[f.stock]];
		walkTo(bay, null);
		act("pick", 2.5, Math.PI, { carry: f.stock });
		const spot = REFILL[f.id];
		walkTo(spot, f.stock);
		const facing = f.id === "denester" ? Math.PI / 2 : 0;
		act("load", 3.5, facing, { carry: f.stock, task: f.id });
		loads[f.id] = t; // stock is in the feeder at the end of the load
		if (f.empties) {
			act("collect", 1.5, facing, { carry: "empties", task: f.id });
			walkTo([PICKUP_X, BAYS.empties], "empties");
			act("drop", 1.5, Math.PI, { carry: "empties" });
		}
		act("watch", 3.0, 0); // glance at the feeder screens before the next refill
	}
	walkTo(POSTS["operator-1"], null);
	act("watch", 4.0, 0);
	return { segs, L: t, loads };
}
const OP1 = buildOp1();

/** Operator 1's pose at time t: {x, y, facing, kind, walk, carry, task}. */
export function op1(t) {
	const tm = ((t % OP1.L) + OP1.L) % OP1.L;
	return poseOf(find(OP1.segs, tm), tm);
}

/**
 * How full a feeder is at time t (1 = just refilled, falls to about 0.2 before the next refill).
 * ids: grapes, apples, crackers, cheese-1..4, lids, denester.
 */
export function level(id, t) {
	const at = OP1.loads[id];
	if (at === undefined) return 1;
	const since = (((t - at) % OP1.L) + OP1.L) % OP1.L;
	return 1 - 0.8 * (since / OP1.L);
}

// ---------------------------------------------------------------------------
// Outfeed carts and rejects (from the line clock)

export const PER_CART = 24;
const PLACE_AFTER_LIFT = 2.6; // seconds from lift to the plate set down in its cart position
const LANE_TIME = 3.0; // seconds for a pushed reject to slide down its lane to the table

/** When good tray m is set down in a cart. */
const placedTime = (m) => (m + P.outfeed) * CYCLE + MOVE + GANTRY_LIFT + PLACE_AFTER_LIFT;

const goods = [];
function goodTray(j) {
	let m = goods.length ? goods[goods.length - 1] + 1 : 0;
	while (goods.length <= j) {
		if (!isReject1(m) && !isReject2(m)) goods.push(m);
		m++;
	}
	return goods[j];
}
/** Time the j-th good plate is set into a cart (plate j goes to cart floor(j/24), slot cart % 2). */
export const plateTime = (j) => placedTime(goodTray(j));
/** Number of plates set into carts by time t. */
export function platesBy(t) {
	let lo = 0;
	let hi = 1;
	while (plateTime(hi - 1) <= t) hi *= 2;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (plateTime(mid) <= t) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/** Reject arrival times at each rework table (tray ids m >= 0). */
function rejectArrivals(which, tMax) {
	const out = [];
	const test = which === 1 ? isReject1 : isReject2;
	const pos = which === 1 ? P.pusher1 : P.pusher2;
	for (let m = 0; (m + pos) * CYCLE < tMax; m++) if (test(m)) out.push({ m, t: (m + pos) * CYCLE + MOVE + 1.0 + LANE_TIME });
	return out;
}

// ---------------------------------------------------------------------------
// Operator 2: works rejects at both tables and swaps full carts, from a post between them.

const SLOT_FRONT = CART_SLOTS.map((s) => [s.curtain + 0.9, (s.y0 + s.y1) / 2]);
const TABLE_FRONT = { "rework-1": [REWORK["rework-1"].x1 + 0.5, (REWORK["rework-1"].y0 + REWORK["rework-1"].y1) / 2], "rework-2": [REWORK["rework-2"].x1 + 0.5, (REWORK["rework-2"].y0 + REWORK["rework-2"].y1) / 2] };
const REENTRY_FRONT = { "rework-1": [REENTRY["rework-1"].x1 + 0.4, REENTRY["rework-1"].y], "rework-2": [REENTRY["rework-2"].x1 + 0.4, REENTRY["rework-2"].y] };
// Full carts go toward the door at the far end; the spare empty cart waits on the other side, so
// the pull-out and push-in paths do not cross.
export const DISPATCH_FULL = [DISPATCH.x1 - 1.8, DISPATCH.y1 + 0.5]; // Operator 2 leaves a full cart at the door
export const DISPATCH_EMPTY = [DISPATCH.x1 - 1.5, DISPATCH.y0 + 1.0]; // where the spare empty cart waits
const AROUND_PARKED = [DISPATCH.x1 - 0.2, DISPATCH.y1 - 0.6]; // walk past the parked full cart on its far side
/** A cart is pushed or pulled this far from Operator 2's center (half a cart, the handle, the person). */
export const CART_REACH = 1.8;
/** A cart leaving or entering a slot is clear of the curtain and gantry posts once its center passes this x. */
const CART_CLEAR_X = 14.6;
const SWAP_DELAY = 6; // seconds after a cart fills before Operator 2 starts the swap
const FIX = 9; // seconds to fix a plate at a rework table


/** Rework table plus its reject lane: Operator 2 walks round these blocks, in front of the tables. */
const BLOCKS = ["rework-1", "rework-2"].map((id) => ({ x0: 11.6, x1: REWORK[id].x1 + 0.2, y0: REWORK[id].y0 - 0.2, y1: REWORK[id].y1 + 0.2 }));
const DETOUR_X = 17.6;

/** Does the segment a-b pass through rectangle b? (Liang-Barsky) */
function crosses(a, b, r) {
	let t0 = 0;
	let t1 = 1;
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	for (const [p, q] of [
		[-dx, a[0] - r.x0],
		[dx, r.x1 - a[0]],
		[-dy, a[1] - r.y0],
		[dy, r.y1 - a[1]],
	]) {
		if (p === 0) {
			if (q < 0) return false;
			continue;
		}
		const k = q / p;
		if (p < 0) t0 = Math.max(t0, k);
		else t1 = Math.min(t1, k);
		if (t0 > t1) return false;
	}
	return t1 - t0 > 1e-6;
}

/** Waypoints that take a walk from a to b round the table blocks it would cross, in order. */
function detour(a, b) {
	const pts = [];
	for (const blk of BLOCKS) {
		if (!crosses(a, b, blk)) continue;
		for (const y of [blk.y0 - 0.35, blk.y1 + 0.35]) if ((y - a[1]) * (y - b[1]) < 0) pts.push([DETOUR_X, y]);
	}
	pts.sort((p, q) => Math.abs(p[1] - a[1]) - Math.abs(q[1] - a[1]));
	return pts;
}

let OP2 = null;
/** Build Operator 2's timeline far enough to cover time tMax. Deterministic; cached. */
function buildOp2(tMax) {
	if (OP2 && OP2.until >= tMax) return OP2;
	const horizon = Math.max(tMax + 600, (OP2?.until ?? 0) * 2, 1200);
	const events = [];
	for (const e of rejectArrivals(1, horizon)) events.push({ t: e.t, kind: "rework", table: "rework-1", m: e.m });
	for (const e of rejectArrivals(2, horizon)) events.push({ t: e.t, kind: "rework", table: "rework-2", m: e.m });
	for (let c = 0; plateTime(c * PER_CART + PER_CART - 1) < horizon; c++) events.push({ t: plateTime(c * PER_CART + PER_CART - 1) + SWAP_DELAY, kind: "swap", cart: c, slot: c % 2 });
	events.sort((a, b) => a.t - b.t || (a.kind === "swap" ? -1 : 1));
	const segs = [];
	const post = POSTS["operator-2"];
	let at = post;
	let t = 0;
	const step = (to, kind, extra) => {
		const d = dist(at, to);
		const v = kind === "push" ? WALK * 0.7 : WALK;
		if (d > 0.01) segs.push({ t0: t, t1: t + d / v, from: at, to, kind, ...extra });
		t += d / v;
		at = to;
	};
	// Walks (not cart pushes) detour in front of the rework tables, whose reject lanes run back to
	// the guard: past each table block via the corners just in front of it.
	const walkTo = (to, kind = "walk", extra = {}) => {
		if (kind !== "push") for (const w of detour(at, to)) step(w, kind, extra);
		step(to, kind, extra);
	};
	const act = (kind, dur, facing, extra = {}) => {
		segs.push({ t0: t, t1: t + dur, from: at, to: at, kind, facing, ...extra });
		t += dur;
	};
	const swaps = [];
	const fixes = [];
	for (const e of events) {
		if (t < e.t) {
			// Idle: go back to the post and watch the screens until the next event.
			walkTo(post);
			if (t < e.t) act("watch", e.t - t, Math.PI);
		}
		if (e.kind === "rework") {
			walkTo(TABLE_FRONT[e.table]);
			const start = t;
			act("fix", FIX, Math.PI, { task: e.table, m: e.m });
			walkTo(REENTRY_FRONT[e.table], "walk", { carry: "plate", task: e.table });
			act("return", 1.5, Math.PI, { carry: "plate", task: e.table });
			fixes.push({ table: e.table, m: e.m, arrive: e.t, pick: start, back: t });
		} else {
			// Carts cross the curtain line only straight along x at the slot's y: pull the full cart
			// straight out until it clears the posts, then turn toward dispatch; bring the empty cart
			// to a point lined up with the slot, step behind it, and push it straight in.
			const slot = SLOT_FRONT[e.slot];
			const ys = slot[1];
			const task = `slot-${e.slot + 1}`;
			walkTo(slot);
			const unl0 = t;
			act("unlatch", 1.5, Math.PI, { task });
			const out0 = t;
			const exitOp = [CART_CLEAR_X + CART_REACH, ys];
			walkTo(exitOp, "push", { carry: "cart-full", task });
			const outMid = t;
			const dir2 = angle(exitOp, DISPATCH_FULL);
			walkTo(DISPATCH_FULL, "push", { carry: "cart-full", task });
			const out1 = t;
			walkTo(AROUND_PARKED);
			const lineUp = [CART_CLEAR_X + 1.8, ys]; // the empty cart's center before it goes in
			const dirA = angle(DISPATCH_EMPTY, lineUp);
			walkTo([DISPATCH_EMPTY[0] - Math.cos(dirA) * CART_REACH, DISPATCH_EMPTY[1] - Math.sin(dirA) * CART_REACH]);
			const in0 = t;
			walkTo([lineUp[0] - Math.cos(dirA) * CART_REACH, lineUp[1] - Math.sin(dirA) * CART_REACH], "push", { carry: "cart-empty", task });
			const inMid = t;
			walkTo([lineUp[0] + CART_REACH, ys], "walk", { task }); // step around behind it
			const inTurn = t;
			walkTo(slot, "push", { carry: "cart-empty", task });
			const in1 = t;
			act("latch", 1.5, Math.PI, { task });
			swaps.push({ cart: e.cart, slot: e.slot, ys, unl0, out0, outMid, dir2, out1, in0, dirA, lineUp, inMid, inTurn, in1, lat1: t });
		}
	}
	walkTo(post);
	act("watch", 1e6, Math.PI);
	OP2 = { segs, swaps, fixes, until: horizon - 300 };
	return OP2;
}

/** Operator 2's pose at time t. */
export function op2(t) {
	const o = buildOp2(t);
	return poseOf(find(o.segs, t), t);
}

const unit = (a) => [Math.cos(a), Math.sin(a)];

/** Angle from a toward b, taking the short way round. */
const lerpAngle = (a, b, k) => {
	let d = b - a;
	while (d > Math.PI) d -= 2 * Math.PI;
	while (d < -Math.PI) d += 2 * Math.PI;
	return a + d * Math.min(1, Math.max(0, k));
};
const TURN = 1.2; // seconds for a cart to swing round behind Operator 2 at a corner

/**
 * State of each cart slot at time t: { cart, count, phase, pos, heading } where phase is
 * "filling" (in the slot, the gantry placing), "full" (waiting for Operator 2), "leaving" (Operator 2
 * pulls it straight out of the slot, then to dispatch staging, the cart trailing CART_REACH behind
 * them), "empty" (no cart in the slot), or "arriving" (Operator 2 pushes the empty cart in front of
 * them to a point lined up with the slot, then straight in). pos is the cart's center [x, y];
 * heading is the direction the cart is moving (0 = +x; PI = into the slot).
 * Also returns `parked` (a full cart waiting in dispatch staging for dispatch to collect),
 * `emptyWaiting` (whether the spare empty cart stands at `emptyPos`).
 */
export function carts(t) {
	const o = buildOp2(t);
	const placed = platesBy(t);
	let emptyWaiting = true;
	const R = CART_REACH;
	const slots = CART_SLOTS.map((s, i) => {
		const center = [(s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2];
		// The cart in (or belonging to) this slot: advance past carts whose replacement is latched in.
		let c = i;
		while (true) {
			const sw = o.swaps.find((x) => x.cart === c);
			if (!sw || t < sw.lat1) break;
			c += 2;
		}
		const sw = o.swaps.find((x) => x.cart === c);
		const count = Math.max(0, Math.min(PER_CART, placed - c * PER_CART));
		if (!sw || t < sw.unl0) return { cart: c, count, phase: count >= PER_CART ? "full" : "filling", pos: center, heading: 0 };
		const ys = sw.ys;
		const slotFront = SLOT_FRONT[i];
		const pulled = [slotFront[0] - R, ys]; // cart center once unlatched, Operator 2 at the slot front
		const leaving = (pos, heading) => ({ cart: c, count: PER_CART, phase: "leaving", pos, heading });
		const arriving = (pos, heading) => {
			emptyWaiting = false;
			return { cart: c + 2, count: 0, phase: "arriving", pos, heading };
		};
		if (t < sw.out0) return leaving(lerp2(center, pulled, (t - sw.unl0) / (sw.out0 - sw.unl0)), 0);
		if (t < sw.outMid) {
			const p = op2(t);
			return leaving([p.x - R, ys], 0);
		}
		if (t < sw.out1) {
			const p = op2(t);
			const h = lerpAngle(0, sw.dir2, (t - sw.outMid) / TURN);
			return leaving([p.x - Math.cos(h) * R, p.y - Math.sin(h) * R], h);
		}
		if (t < sw.in0) return { cart: c + 2, count: 0, phase: "empty", pos: null, heading: 0 };
		if (t < sw.inMid) {
			const p = op2(t);
			return arriving([p.x + Math.cos(sw.dirA) * R, p.y + Math.sin(sw.dirA) * R], sw.dirA);
		}
		if (t < sw.inTurn) return arriving(sw.lineUp, lerpAngle(sw.dirA, Math.PI, (t - sw.inMid) / Math.max(0.3, sw.inTurn - sw.inMid)));
		if (t < sw.in1) {
			const p = op2(t);
			return arriving([p.x - R, ys], Math.PI);
		}
		return arriving(lerp2(pulled, center, (t - sw.in1) / (sw.lat1 - sw.in1)), Math.PI);
	});
	// A full cart waits in dispatch staging for a while after it is left there, then dispatch takes it.
	const last = o.swaps.filter((x) => t >= x.out1 && t < x.out1 + 90).pop();
	const parked = last ? [{ pos: [DISPATCH_FULL[0] - Math.cos(last.dir2) * R, DISPATCH_FULL[1] - Math.sin(last.dir2) * R], heading: last.dir2, full: true, cart: last.cart }] : [];
	return { slots, parked, emptyWaiting, emptyPos: DISPATCH_EMPTY };
}

/** Rejects sitting on a rework table at time t: [{m, since}] (picked up when Operator 2 starts fixing). */
export function rejectsOn(table, t) {
	const o = buildOp2(t);
	return o.fixes.filter((f) => f.table === table && t >= f.arrive && t < f.pick + FIX).map((f) => ({ m: f.m, since: f.arrive, fixing: t >= f.pick }));
}

/** The technician: on call at the controller cabinet, checking the screens. */
export function tech(t) {
	const [x, y] = POSTS.technician;
	const glance = Math.sin(t * 0.25) > 0.6;
	return { x, y, facing: Math.PI, kind: glance ? "check" : "watch", walk: undefined, carry: null, task: null };
}
