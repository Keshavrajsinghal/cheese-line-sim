// Turns the people schedules (schedule.js) into drawable poses: where the body stands, where it
// faces, where each hand and foot is, and what it holds. Pure functions of line time.
//
// A pose ("spec") is { x, y, facing, lean, bob, feet, hands, item, head, slide }:
//   feet:  [[f, sd, lift], [f, sd, lift]]  left, right, in the body frame (f forward, sd to the left)
//   hands: [[f, sd, z], [f, sd, z]]        left, right hand targets in the body frame
//   item:  { kind, f, sd, z, pitch, yaw, open, lane, from, table } carried thing, or null
//   head:  yaw of the head relative to the body
//   slide: a plate let go into a re-entry chute { x, y, z, table } (Operator 2), or null
//   scan:  a barcode scan in the right hand { from, to } (body frame), or null; holster: scanner on the hip
// Moves between schedule segments are blended over BLEND seconds so poses never jump.
//
// Two schedule paths cross things (reported; the schedule owner will fix them). Until then,
// straight walks that would pass through the guarded cell, a rework table, a reject lane, or a
// cart are drawn along a detour round its corners, in the same time.

import { clamp01, ease, lerp } from "./common.js";
import { CART_SLOTS, GUARD, LANES, POSTS, REWORK, STAGING } from "./layout.js";
import { HMI } from "./people-cabinet.js";
import { SIZE } from "./people-carry.js";
import { carts, DISPATCH_EMPTY, op1, op2, tech } from "./schedule.js";

const BLEND = 0.5;
const STRIDE = 1.1; // meters per full walk cycle (two steps)
const WALK = 1.25; // schedule walking speed, m/s
const PUSH = 0.7; // pushing speed as a fraction of walking
const CART_BAR = 1.6; // push bar center, from the cart center (st-outfeed)
const BAR_Z = 1.05;
const BAR_HALF = 0.95;

const REST = () => [
	[0.03, 0.25, 0.79],
	[0.03, -0.25, 0.79],
];
const STAND = () => [
	[0.03, 0.1, 0],
	[0.03, -0.1, 0],
];
const CARRY = { f: 0.36, z: 0.86 };

// ---------------------------------------------------------------------------
// Small helpers

const wrap = (a) => {
	let d = a;
	while (d > Math.PI) d -= 2 * Math.PI;
	while (d < -Math.PI) d += 2 * Math.PI;
	return d;
};
const lerpAngle = (a, b, k) => a + wrap(b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const phaseOf = (k, a, b) => ease(clamp01((k - a) / (b - a)));

/** World point -> body frame [f, sd] of a spec. */
function toBody(s, p) {
	const dx = p[0] - s.x;
	const dy = p[1] - s.y;
	const c = Math.cos(s.facing);
	const n = Math.sin(s.facing);
	return [dx * c + dy * n, -dx * n + dy * c];
}

function base(p) {
	return { x: p.x, y: p.y, facing: p.facing, lean: 0, bob: 0, feet: STAND(), hands: REST(), item: null, head: 0, slide: null, scan: null, holster: false };
}

/** Move the body forward along its facing (stepping up to a rack, a feeder, a table). */
function shift(s, d) {
	s.x += Math.cos(s.facing) * d;
	s.y += Math.sin(s.facing) * d;
}

/** Item-space point (u forward, v across, w up) to the body frame, with the item's pitch. */
export function itemToBody(it, u, v, w) {
	const p = it.pitch ?? 0;
	return [it.f + u * Math.cos(p) + w * Math.sin(p), it.sd + v, it.z - u * Math.sin(p) + w * Math.cos(p)];
}

/** Both hands on the sides of an item. */
function holdHands(it) {
	const sz = SIZE[it.kind] ?? SIZE.trays;
	const v = sz.w / 2 + 0.03;
	const w = it.kind === "plate" ? 0.04 : sz.h * 0.5;
	return [itemToBody(it, 0, v, w), itemToBody(it, 0, -v, w)];
}

function walkFeet(phase) {
	const a = phase * Math.PI * 2;
	const sn = Math.sin(a);
	const cs = Math.cos(a);
	return {
		feet: [
			[0.03 + 0.27 * sn, 0.1, 0.07 * Math.max(0, cs)],
			[0.03 - 0.27 * sn, -0.1, 0.07 * Math.max(0, -cs)],
		],
		bob: 0.022 * (0.5 + 0.5 * Math.cos(2 * a)),
	};
}

function swingHands(phase) {
	const sn = Math.sin(phase * Math.PI * 2);
	return [
		[0.03 - 0.17 * sn, 0.25, 0.8],
		[0.03 + 0.17 * sn, -0.25, 0.8],
	];
}

// ---------------------------------------------------------------------------
// Detours: oriented rectangles { c, a, hl, hw } (clearance included) and a small visibility graph.

const box = (x0, y0, x1, y1) => ({ c: [(x0 + x1) / 2, (y0 + y1) / 2], a: 0, hl: (x1 - x0) / 2, hw: (y1 - y0) / 2, key: `${x0},${y0}` });

function local(o, p) {
	const dx = p[0] - o.c[0];
	const dy = p[1] - o.c[1];
	const c = Math.cos(o.a);
	const n = Math.sin(o.a);
	return [dx * c + dy * n, -dx * n + dy * c];
}
const inside = (o, p) => {
	const [u, v] = local(o, p);
	return Math.abs(u) < o.hl - 0.005 && Math.abs(v) < o.hw - 0.005;
};
function crosses(o, a, b) {
	const A = local(o, a);
	const B = local(o, b);
	const e = 0.01;
	const d = [B[0] - A[0], B[1] - A[1]];
	const P = [-d[0], d[0], -d[1], d[1]];
	const Q = [A[0] + o.hl - e, o.hl - e - A[0], A[1] + o.hw - e, o.hw - e - A[1]];
	let t0 = 0;
	let t1 = 1;
	for (let i = 0; i < 4; i++) {
		if (Math.abs(P[i]) < 1e-12) {
			if (Q[i] < 0) return false;
			continue;
		}
		const r = Q[i] / P[i];
		if (P[i] < 0) {
			if (r > t1) return false;
			if (r > t0) t0 = r;
		} else {
			if (r < t0) return false;
			if (r < t1) t1 = r;
		}
	}
	return t1 - t0 > 1e-4;
}
function corners(o, pad) {
	const c = Math.cos(o.a);
	const n = Math.sin(o.a);
	return [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	].map(([su, sv]) => {
		const u = su * (o.hl + pad);
		const v = sv * (o.hw + pad);
		return [o.c[0] + u * c - v * n, o.c[1] + u * n + v * c];
	});
}

const routes = new Map();
/** Shortest path from a to b round the obstacles, or null when the straight line is clear. */
function detour(a, b, obstacles) {
	const obs = obstacles.filter((o) => !inside(o, a) && !inside(o, b));
	if (!obs.some((o) => crosses(o, a, b))) return null;
	const key = `${a[0].toFixed(2)},${a[1].toFixed(2)}>${b[0].toFixed(2)},${b[1].toFixed(2)}|${obs.map((o) => o.key).join(";")}`;
	if (routes.has(key)) return routes.get(key);
	const nodes = [a, b];
	for (const o of obs) for (const p of corners(o, 0.03)) if (!obs.some((q) => inside(q, p))) nodes.push(p);
	const n = nodes.length;
	const dist = new Array(n).fill(Number.POSITIVE_INFINITY);
	const prev = new Array(n).fill(-1);
	const done = new Array(n).fill(false);
	dist[0] = 0;
	for (;;) {
		let u = -1;
		for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
		if (u < 0 || dist[u] === Number.POSITIVE_INFINITY || u === 1) break;
		done[u] = true;
		for (let v = 0; v < n; v++) {
			if (done[v] || v === u || obs.some((o) => crosses(o, nodes[u], nodes[v]))) continue;
			const d = dist[u] + Math.hypot(nodes[v][0] - nodes[u][0], nodes[v][1] - nodes[u][1]);
			if (d < dist[v]) {
				dist[v] = d;
				prev[v] = u;
			}
		}
	}
	let path = null;
	if (dist[1] < Number.POSITIVE_INFINITY) {
		path = [];
		for (let v = 1; v >= 0; v = prev[v]) path.unshift(nodes[v]);
	}
	if (routes.size > 400) routes.clear();
	routes.set(key, path);
	return path;
}

function pathLength(path) {
	let L = 0;
	for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
	return L;
}
function pointAt(path, s) {
	let left = Math.max(0, s);
	for (let i = 1; i < path.length; i++) {
		const a = path[i - 1];
		const b = path[i];
		const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (left <= d || i === path.length - 1) {
			const k = d > 0 ? Math.min(1, left / d) : 1;
			return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
		}
		left -= d;
	}
	return path[path.length - 1];
}

/**
 * Walking or pushing: reconstruct the straight schedule segment from the pose, take a detour if it
 * crosses an obstacle, and return position, facing, feet, and the distance walked so far.
 */
function walking(p, obstacles) {
	const speed = p.kind === "push" ? PUSH : 1;
	const done = (p.walk ?? 0) * STRIDE * speed;
	let x = p.x;
	let y = p.y;
	let facing = p.facing;
	let s = done;
	if (obstacles && p.k > 1e-4 && p.k < 1 && done > 0.02) {
		const ux = Math.cos(p.facing);
		const uy = Math.sin(p.facing);
		const from = [p.x - ux * done, p.y - uy * done];
		const len = done / p.k;
		const to = [from[0] + ux * len, from[1] + uy * len];
		const path = detour(from, to, obstacles);
		if (path) {
			s = p.k * pathLength(path);
			[x, y] = pointAt(path, s);
			const a = pointAt(path, s - 0.35);
			const b = pointAt(path, s + 0.35);
			facing = Math.atan2(b[1] - a[1], b[0] - a[0]);
		}
	}
	const w = walkFeet(s / STRIDE);
	return { x, y, facing, feet: w.feet, bob: w.bob, phase: s / STRIDE, elapsed: done / (WALK * speed) };
}

// ---------------------------------------------------------------------------
// Blending between schedule segments

const ident = (p) => `${p.kind}|${p.carry}|${p.task}|${p.facing.toFixed(2)}`;

/** Seconds since the schedule segment at t began, up to max. */
function segElapsed(fn, t, max) {
	const id = ident(fn(t));
	if (ident(fn(t - max)) === id) return max;
	let lo = t - max;
	let hi = t;
	for (let i = 0; i < 7; i++) {
		const mid = (lo + hi) / 2;
		if (ident(fn(mid)) === id) hi = mid;
		else lo = mid;
	}
	return t - hi;
}

function blend(a, b, k) {
	const hands = a.hands.map((h, i) => lerp3(h, b.hands[i], k));
	const feet = a.feet.map((f, i) => lerp3(f, b.feet[i], k));
	let item = b.item;
	if (a.item && b.item && a.item.kind === b.item.kind) item = { ...b.item, f: lerp(a.item.f, b.item.f, k), z: lerp(a.item.z, b.item.z, k), pitch: lerp(a.item.pitch ?? 0, b.item.pitch ?? 0, k) };
	return { ...b, x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), facing: lerpAngle(a.facing, b.facing, k), lean: lerp(a.lean, b.lean, k), bob: lerp(a.bob, b.bob, k), head: lerp(a.head, b.head, k), hands, feet, item };
}

function blended(raw, fn, t) {
	const cur = raw(t);
	const e = segElapsed(fn, t, BLEND);
	if (e >= BLEND) return cur;
	return blend(raw(t - e - 0.003), cur, ease(e / BLEND));
}

// ---------------------------------------------------------------------------
// Operator 1: supply aisle, staging racks, feeders through the back guard openings.

const M1 = 0.45;
const OP1_OBST = [box(GUARD.back - M1, GUARD.head - M1, GUARD.front + M1, 46 + M1), box(STAGING.x0 - 0.3, STAGING.y0 - 0.3, STAGING.x1 + 0.3, STAGING.y1 + 0.3)];
const SHELF = { f: 0.78, z: 1.1 }; // stock on the upper rack shelf, in front of the body after the step in
const STEP_PICK = 0.22;
const STEP_LOAD = 0.55; // up to the guard opening; the body stays outside the guard line
const FEED = { f: 0.86, z: 1.0 }; // stock slid into the feeder mouth at the guard line

/** The feeder Operator 1 will load next (for which cheese lane's trays they carry). */
function nextLoad(t) {
	for (let d = 0; d < 40; d += 0.5) {
		const q = op1(t + d);
		if (q.kind === "load") return q.task;
	}
	return null;
}
/** The feeder the empties being carried came from. */
function lastCollect(t) {
	for (let d = 0; d < 40; d += 0.5) {
		const q = op1(t - d);
		if (q.kind === "collect") return q.task;
	}
	return null;
}
const laneOf = (task) => (task?.startsWith("cheese-") ? Number(task.slice(7)) - 1 : 0);

function op1Item(p, t, at) {
	if (!p.carry) return null;
	const it = { kind: p.carry, f: at.f, sd: 0, z: at.z, pitch: 0 };
	if (p.carry === "cheese" || p.carry === "cheese2") {
		it.kind = "cheese";
		it.lane = laneOf(p.kind === "load" ? p.task : nextLoad(t));
	} else if (p.carry === "empties") {
		const src = p.kind === "collect" ? p.task : lastCollect(t);
		it.from = src?.startsWith("cheese") ? "cheese" : "pocket";
		it.lane = laneOf(src);
	}
	return it;
}

function op1Raw(t) {
	const p = op1(t);
	const s = base(p);
	s.holster = true;
	const k = p.k;
	if (p.kind === "walk") {
		const w = walking(p, OP1_OBST);
		Object.assign(s, { x: w.x, y: w.y, facing: w.facing, feet: w.feet, bob: w.bob });
		const it = op1Item(p, t, { f: CARRY.f, z: CARRY.z + w.bob });
		if (it) {
			s.item = it;
			s.hands = holdHands(it);
		} else s.hands = swingHands(w.phase);
		return s;
	}
	if (p.kind === "pick") {
		const reach = phaseOf(k, 0, 0.35);
		const back = phaseOf(k, 0.5, 1);
		shift(s, STEP_PICK * reach * (1 - back));
		s.lean = 0.3 * reach * (1 - back);
		const at = k < 0.5 ? SHELF : { f: lerp(SHELF.f, CARRY.f, back), z: lerp(SHELF.z, CARRY.z, back) };
		const it = op1Item(p, t, at);
		if (k < 0.38) s.hands = REST().map((h, i) => lerp3(h, holdHands(it)[i], reach));
		else {
			s.item = it;
			s.hands = holdHands(it);
		}
		return s;
	}
	if (p.kind === "load") {
		const scanning = p.carry === "cheese" || p.carry === "cheese2";
		const step = phaseOf(k, 0, 0.22);
		const push = scanning ? phaseOf(k, 0.38, 0.86) : phaseOf(k, 0.18, 0.82);
		shift(s, STEP_LOAD * step);
		s.lean = 0.1 + 0.25 * push;
		const it = op1Item(p, t, { f: lerp(CARRY.f, FEED.f, push), z: lerp(CARRY.z, FEED.z, step) });
		if (it.kind === "apples") {
			// Lid off, then tip the tub into the hopper.
			it.open = k > 0.25;
			it.f = lerp(CARRY.f, 0.7, push);
			it.pitch = 1.75 * phaseOf(k, 0.5, 0.85);
			it.z += 0.34 * phaseOf(k, 0.3, 0.6); // up over the hopper rim
		}
		s.hands = holdHands(it);
		if (it.kind === "cheese") {
			// Scan the stack's barcode before it goes into the lane (right hand, then back on the stack).
			const scan = phaseOf(k, 0, 0.06) * (1 - phaseOf(k, 0.3, 0.37));
			const sz = SIZE.cheese;
			const at = itemToBody(it, -0.04, -(sz.w / 2 + 0.17), sz.h * 0.55);
			s.hands[1] = lerp3(s.hands[1], at, scan);
			s.scan = scan > 0.6 ? { from: at, to: itemToBody(it, -0.04, -sz.w / 2, sz.h * 0.55) } : null;
		}
		if (k < 0.96) s.item = it;
		return s;
	}
	if (p.kind === "collect") {
		const pull = phaseOf(k, 0, 0.5);
		shift(s, STEP_LOAD * (1 - phaseOf(k, 0.3, 0.95)));
		s.lean = 0.35 * (1 - pull);
		s.item = op1Item(p, t, { f: lerp(FEED.f, CARRY.f, pull), z: lerp(FEED.z, CARRY.z, pull) });
		s.hands = holdHands(s.item);
		return s;
	}
	if (p.kind === "drop") {
		const reach = phaseOf(k, 0, 0.4);
		const back = phaseOf(k, 0.55, 1);
		shift(s, STEP_PICK * reach * (1 - back));
		s.lean = 0.3 * reach * (1 - back);
		const it = op1Item(p, t, { f: lerp(CARRY.f, SHELF.f, reach), z: lerp(CARRY.z, SHELF.z, reach) });
		if (k < 0.5) {
			s.item = it;
			s.hands = holdHands(it);
		} else s.hands = holdHands(it).map((h, i) => lerp3(h, REST()[i], back));
		return s;
	}
	// watch: glance over the feeder screens and level lights.
	s.head = 0.45 * Math.sin(t * 0.6);
	return s;
}

// ---------------------------------------------------------------------------
// Operator 2: rework tables, re-entry chutes, cart slots, dispatch staging.

const SLOT_FRONT = CART_SLOTS.map((c) => [c.curtain + 0.9, (c.y0 + c.y1) / 2]);
const M2 = 0.35;
const OP2_OBST = [
	box(GUARD.back, GUARD.head, GUARD.front + 0.3, 46),
	...Object.values(REWORK).map((r) => box(r.x0 - M2, r.y0 - M2, r.x1 + M2, r.y1 + M2)),
	...LANES.map((l) => box(GUARD.front, l.y - 0.4, l.x1, l.y + 0.4)),
];
const CART_HL = 1.48 + 0.12; // half a cart plus its push bar
const CART_HW = 1.38;
const cartBox = (pos, a, key) => ({ c: pos, a, hl: CART_HL + 0.05, hw: CART_HW + 0.05, key });

/** Obstacles for a walk at time t: the fixed ones plus carts standing in dispatch staging. */
function op2Obstacles(t, p) {
	const c = carts(t);
	const out = [...OP2_OBST];
	for (const pk of c.parked) out.push(cartBox(pk.pos, pk.heading ?? 0, `parked${pk.cart}`));
	const swapping = c.slots.findIndex((x) => x.phase === "empty");
	if (c.emptyWaiting || swapping >= 0) {
		const ys = SLOT_FRONT[Math.max(0, swapping)][1];
		out.push(cartBox(DISPATCH_EMPTY, Math.atan2(ys - DISPATCH_EMPTY[1], 16.4 - DISPATCH_EMPTY[0]), `spare${swapping}`));
	}
	if (p.task?.startsWith("slot-")) {
		const i = p.task === "slot-2" ? 1 : 0;
		const sc = c.slots[i];
		if (sc.pos && sc.phase === "arriving") out.push(cartBox(sc.pos, Math.PI, `lineup${i}`));
	}
	return out;
}

/** Hands on the push bar of the cart Operator 2 is moving (the end of the cart nearest them). */
function barHands(s, t, task, which = "both") {
	const i = task === "slot-2" ? 1 : 0;
	const c = carts(t).slots[i];
	if (!c?.pos) return null;
	let ux = Math.cos(c.heading);
	let uy = Math.sin(c.heading);
	if (ux * (s.x - c.pos[0]) + uy * (s.y - c.pos[1]) < 0) {
		ux = -ux;
		uy = -uy;
	}
	const B = [c.pos[0] + ux * CART_BAR, c.pos[1] + uy * CART_BAR];
	const ax = [-uy, ux];
	const fc = Math.cos(s.facing);
	const fs = Math.sin(s.facing);
	const hand = (side) => {
		const nat = [s.x - fs * side * 0.24, s.y + fc * side * 0.24];
		const proj = Math.max(-BAR_HALF, Math.min(BAR_HALF, (nat[0] - B[0]) * ax[0] + (nat[1] - B[1]) * ax[1]));
		const [f, sd] = toBody(s, [B[0] + ax[0] * proj, B[1] + ax[1] * proj]);
		return [f, sd, BAR_Z];
	};
	const bf = toBody(s, B)[0];
	if (which === "right") return { hands: [null, hand(-1)], barF: bf };
	return { hands: [hand(1), hand(-1)], barF: bf };
}

const screenAngle = (id) => {
	const [px, py] = POSTS["operator-2"];
	const [sx, sy] = REWORK[id].screen;
	return Math.atan2(sy - py, sx - px);
};
const LOOK = [Math.PI, Math.PI + wrap(screenAngle("rework-2") - Math.PI), Math.PI + wrap(screenAngle("rework-1") - Math.PI)];
/** At the post: look over the rework screens in turn, and back at the line end. */
function watchFacing(t) {
	const keys = [
		[0, 0],
		[2, 0],
		[3.5, 1],
		[7, 1],
		[8.5, 0],
		[11, 0],
		[12.5, 2],
		[16, 2],
		[17.5, 0],
		[19, 0],
	];
	const u = ((t % 19) + 19) % 19;
	for (let i = 1; i < keys.length; i++) {
		const [t0, a] = keys[i - 1];
		const [t1, b] = keys[i];
		if (u <= t1) return lerp(LOOK[a], LOOK[b], ease((u - t0) / (t1 - t0)));
	}
	return LOOK[0];
}

const PLATE_TABLE_X = 16.45; // where st-downstream draws a reject waiting on its table
const PLATE_TABLE_Z = 0.82;
const PLATE_CARRY = { f: 0.42, z: 0.95 };
const CHUTE = { set: 13.58, end: 13.4, z: 1.0 }; // plate set on the chute mouth, pushed to the hatch (st-downstream takes it from x 13.4)

function op2Raw(t) {
	const p = op2(t);
	const s = base(p);
	const k = p.k;
	if (p.kind === "walk") {
		const w = walking(p, op2Obstacles(t, p));
		Object.assign(s, { x: w.x, y: w.y, facing: w.facing, feet: w.feet, bob: w.bob });
		if (p.carry === "plate") {
			// Pick the fixed plate up off the table at the start of the walk (resolved in finish()).
			const tableY = (REWORK[p.task].y0 + REWORK[p.task].y1) / 2;
			s.item = { kind: "plate", table: p.task, f: PLATE_CARRY.f, sd: 0, z: PLATE_CARRY.z + w.bob, pitch: 0, yaw: 0 };
			s.item.from = { x: PLATE_TABLE_X, y: tableY, z: PLATE_TABLE_Z, heading: Math.PI / 2, lift: ease(clamp01(w.elapsed / BLEND)) };
			s.hands = holdHands(s.item);
		} else s.hands = swingHands(w.phase);
		return s;
	}
	if (p.kind === "push") {
		const w = walking(p, null);
		Object.assign(s, { feet: w.feet, bob: w.bob });
		if (p.carry === "cart-full") {
			// Pulling the full cart: walking ahead, one arm back on the bar.
			const bh = barHands(s, t, p.task, "right");
			s.hands = swingHands(w.phase);
			if (bh) s.hands[1] = bh.hands[1];
			s.lean = 0.12;
		} else {
			const bh = barHands(s, t, p.task);
			if (bh) s.hands = bh.hands;
			s.lean = 0.16;
		}
		return s;
	}
	if (p.kind === "unlatch" || p.kind === "latch") {
		const bh = barHands(s, t, p.task);
		if (!bh) return s;
		const inK = p.kind === "unlatch" ? phaseOf(k, 0, 0.25) : 1 - phaseOf(k, 0.75, 1);
		// Step up to the bar (to the light curtain at most), unhook or hook the floor latch, then
		// walk the cart out (or in) holding the bar.
		const reach = Math.max(0, Math.min(0.85, bh.barF - 0.42)) * inK;
		shift(s, reach);
		const bh2 = barHands(s, t, p.task);
		s.hands = bh2.hands;
		const flick = p.kind === "unlatch" ? phaseOf(k, 0.12, 0.28) * (1 - phaseOf(k, 0.3, 0.45)) : phaseOf(k, 0.5, 0.62) * (1 - phaseOf(k, 0.68, 0.8));
		s.hands[0] = [s.hands[0][0], s.hands[0][1], lerp(BAR_Z, 0.55, flick)];
		s.lean = 0.12 + 0.4 * flick;
		if (p.kind === "latch") s.hands = s.hands.map((h, i) => lerp3(h, REST()[i], phaseOf(k, 0.78, 1)));
		if (p.kind === "unlatch") s.hands = s.hands.map((h, i) => lerp3(REST()[i], h, phaseOf(k, 0, 0.2)));
		return s;
	}
	if (p.kind === "fix") {
		// At the table: one hand steadies the plate, the other adds the missing item from the kit.
		shift(s, 0.22);
		s.lean = 0.45;
		const u = (k * 9) % 3;
		const toKit = phaseOf(u, 0, 0.8) * (1 - phaseOf(u, 1.3, 2.1));
		const tap = Math.sin(u * 7) * 0.015 * phaseOf(u, 2.1, 2.3);
		s.hands = [
			[0.5, 0.18, 0.9],
			lerp3([0.56, -0.04, 0.9 + tap], [0.48, -0.5, 0.92], toKit),
		];
		s.head = -0.25 * toKit;
		return s;
	}
	if (p.kind === "return") {
		// Set the plate on the chute mouth, push it up to the hatch curtain, let go at the end.
		const set = phaseOf(k, 0, 0.4);
		const push = phaseOf(k, 0.45, 0.88);
		const lift = Math.sin(Math.PI * clamp01(k / 0.4)) * 0.08;
		s.lean = 0.2 * set + 0.15 * push;
		const f = lerp(lerp(PLATE_CARRY.f, s.x - CHUTE.set, set), s.x - CHUTE.end, push);
		const it = { kind: "plate", table: p.task, f, sd: 0, z: lerp(PLATE_CARRY.z, CHUTE.z, set) + lift, pitch: 0, yaw: 0 };
		const held = holdHands(it);
		if (k < 0.9) {
			s.item = it;
			s.hands = held;
		} else {
			s.hands = held.map((h, i) => lerp3(h, REST()[i], phaseOf(k, 0.9, 1) * 0.5));
			s.slide = { x: CHUTE.end, y: p.y, z: CHUTE.z, table: p.task };
		}
		return s;
	}
	// watch: at the post, checking the rework screens and the line end.
	s.facing = watchFacing(t);
	s.head = 0.2 * Math.sin(t * 0.5);
	s.hands = [
		[0.15, 0.07, 1.0],
		[0.15, -0.07, 1.0],
	];
	return s;
}

// ---------------------------------------------------------------------------
// The technician at the controller cabinet (warm corridor).

function techRaw(t) {
	const p = tech(t);
	const s = base(p);
	s.facing = Math.atan2(HMI.y - p.y, HMI.x - p.x);
	const d = Math.hypot(HMI.x - p.x, HMI.y - p.y);
	if (p.kind === "check") {
		const step = 0.3;
		shift(s, step);
		s.lean = 0.08;
		const swipe = Math.sin(t * 2.2) * 0.06;
		s.hands = [
			[0.12, 0.24, 0.86],
			[d - step - 0.05, -0.02 + swipe, HMI.z + 0.02],
		];
		return s;
	}
	// watch: arms folded, scanning the controller doors and status lamps.
	s.head = 0.4 * Math.sin(t * 0.35) - 0.15;
	s.hands = [
		[0.17, -0.06, 1.1],
		[0.17, 0.06, 1.06],
	];
	return s;
}

// ---------------------------------------------------------------------------

/** Late binding after blending: an item still on its way up from a world spot (a plate on a table). */
function finish(s) {
	const it = s.item;
	if (!it?.from || it.from.lift >= 1) return s;
	const { x, y, z, heading, lift } = it.from;
	const [f, sd] = toBody(s, [x, y]);
	s.item = { ...it, f: lerp(f, it.f, lift), sd: lerp(sd, it.sd, lift), z: lerp(z, it.z, lift), yaw: lerp(wrap(heading - (s.facing - Math.PI / 2)), 0, lift) };
	s.hands = holdHands(s.item);
	return s;
}

export const POSE = {
	"operator-1": (t) => blended(op1Raw, op1, t),
	"operator-2": (t) => finish(blended(op2Raw, op2, t)),
	technician: (t) => blended(techRaw, tech, t),
};
