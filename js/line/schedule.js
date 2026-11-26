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

function buildOp1() {
	const segs = [];
	let t = 0;
	let at = POSTS["operator-1"];
	const walkTo = (to, carry) => {
		const d = dist(at, to);
		if (d > 0.01) segs.push({ t0: t, t1: t + d / WALK, from: at, to, kind: "walk", carry });
		t += d / WALK;
		at = to;
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
export const DISPATCH_FULL = [DISPATCH.x0 + 1.4, DISPATCH.y0 + 2.0]; // where full carts are left
export const DISPATCH_EMPTY = [DISPATCH.x1 - 1.4, DISPATCH.y1 - 2.0]; // where empty carts wait
const SWAP_DELAY = 6; // seconds after a cart fills before Operator 2 starts the swap
const FIX = 9; // seconds to fix a plate at a rework table

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
	const walkTo = (to, kind = "walk", extra = {}) => {
		const d = dist(at, to);
		if (d > 0.01) segs.push({ t0: t, t1: t + d / (kind === "push" ? WALK * 0.7 : WALK), from: at, to, kind, ...extra });
		t += d / (kind === "push" ? WALK * 0.7 : WALK);
		at = to;
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
			const slot = SLOT_FRONT[e.slot];
			walkTo(slot);
			const unl0 = t;
			act("unlatch", 1.5, Math.PI, { task: `slot-${e.slot + 1}` });
			const out0 = t;
			walkTo(DISPATCH_FULL, "push", { carry: "cart-full", task: `slot-${e.slot + 1}` });
			const out1 = t;
			walkTo(DISPATCH_EMPTY);
			const in0 = t;
			walkTo(slot, "push", { carry: "cart-empty", task: `slot-${e.slot + 1}` });
			const in1 = t;
			act("latch", 1.5, Math.PI, { task: `slot-${e.slot + 1}` });
			swaps.push({ cart: e.cart, slot: e.slot, unl0, out0, out1, in0, in1, lat1: t });
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

/** A cart is pushed or pulled about this far from Operator 2's center. */
export const CART_REACH = 1.15;
const unit = (a) => [Math.cos(a), Math.sin(a)];

/**
 * State of each cart slot at time t: { cart, count, phase, pos, heading } where phase is
 * "filling" (in the slot, the gantry placing), "full" (waiting for Operator 2), "leaving" (Operator 2
 * pulls it out of the slot and to dispatch staging, the cart trailing behind them), "empty" (no
 * cart in the slot), or "arriving" (Operator 2 pushes an empty cart in front of them, then slides
 * it into the slot). pos is the cart's center [x, y]; heading the direction it is moving.
 * Also returns `parked` (full carts waiting in dispatch staging for dispatch to collect) and
 * `emptyWaiting` (whether the spare empty cart stands in dispatch staging).
 */
export function carts(t) {
	const o = buildOp2(t);
	const placed = platesBy(t);
	let emptyWaiting = true;
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
		const slotFront = SLOT_FRONT[i];
		const outDir = angle(slotFront, DISPATCH_FULL);
		const [ux, uy] = unit(outDir);
		const pullStart = [slotFront[0] - ux * CART_REACH, slotFront[1] - uy * CART_REACH];
		if (t < sw.out0) return { cart: c, count: PER_CART, phase: "leaving", pos: lerp2(center, pullStart, (t - sw.unl0) / (sw.out0 - sw.unl0)), heading: 0 };
		if (t < sw.out1) {
			const p = op2(t);
			const [dx, dy] = unit(p.facing);
			return { cart: c, count: PER_CART, phase: "leaving", pos: [p.x - dx * CART_REACH, p.y - dy * CART_REACH], heading: p.facing };
		}
		if (t < sw.in0) return { cart: c + 2, count: 0, phase: "empty", pos: null, heading: 0 };
		if (t < sw.in1) {
			emptyWaiting = false;
			const p = op2(t);
			const [dx, dy] = unit(p.facing);
			return { cart: c + 2, count: 0, phase: "arriving", pos: [p.x + dx * CART_REACH, p.y + dy * CART_REACH], heading: p.facing };
		}
		emptyWaiting = false;
		const inDir = angle(DISPATCH_EMPTY, slotFront);
		const [vx, vy] = unit(inDir);
		const pushEnd = [slotFront[0] + vx * CART_REACH, slotFront[1] + vy * CART_REACH];
		return { cart: c + 2, count: 0, phase: "arriving", pos: lerp2(pushEnd, center, (t - sw.in1) / (sw.lat1 - sw.in1)), heading: inDir };
	});
	// A full cart waits in dispatch staging for a while after it is left there, then dispatch takes it.
	const last = o.swaps.filter((x) => t >= x.out1 && t < x.out1 + 90).pop();
	let parked = [];
	if (last) {
		const [ux, uy] = unit(angle(SLOT_FRONT[last.slot], DISPATCH_FULL));
		parked = [{ pos: [DISPATCH_FULL[0] - ux * CART_REACH, DISPATCH_FULL[1] - uy * CART_REACH], full: true, cart: last.cart }];
	}
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
