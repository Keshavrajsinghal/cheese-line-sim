// The line's shared clock: every animated station, tray, and person derives its pose from the
// same step counter, so a robot places an item exactly when the tray under it gains it.
//
// One step = the belt moves every tray forward one position (MOVE seconds), then every station
// works on a still tray (the rest of the step). Pacing mirrors the design's full-speed step
// (5.87 s of apple work + 1.5 s belt move); these numbers drive animation only and are never
// shown as text.

import { ACC, GATE, slotY } from "./layout.js";

export const MOVE = 1.5;
export const WORK = 5.87;
export const CYCLE = MOVE + WORK;

/** n: step count; u: seconds into the step (0..CYCLE). The belt moves during u < MOVE. */
export function clock(t) {
	const n = Math.floor(t / CYCLE);
	return { n, u: t - n * CYCLE };
}
export const moving = (u) => u < MOVE;
/** Seconds into the work window (negative while the belt is still moving). */
export const work = (u) => u - MOVE;

// ---------------------------------------------------------------------------
// Tray positions: indexing slots 0-10, then the accumulation conveyor's queue and gates.

const QUEUE = [];
for (let y = ACC.y0 + 0.7; y < GATE["inspect-1"] - 1.0; y += ACC.gap) QUEUE.push(+y.toFixed(2));

/** y of every position a tray rests at, in order. Index = steps since the tray left the denester. */
export const POS = [...Array.from({ length: 11 }, (_, j) => slotY(j)), ...QUEUE, GATE["inspect-1"], GATE.pusher1, GATE.lidding, GATE.coder, GATE["inspect-2"], GATE.pusher2, GATE.outfeed];
export const P = {
	denester: 0,
	grapes: 2,
	"apples-a": 4,
	"apples-b": 5,
	crackers: 7,
	"cheese-a": 9,
	"cheese-b": 10,
	buffer: POS.indexOf(GATE.buffer) >= 0 ? POS.indexOf(GATE.buffer) : 11 + Math.floor(QUEUE.length / 2),
	"inspect-1": POS.indexOf(GATE["inspect-1"]),
	pusher1: POS.indexOf(GATE.pusher1),
	lidding: POS.indexOf(GATE.lidding),
	coder: POS.indexOf(GATE.coder),
	"inspect-2": POS.indexOf(GATE["inspect-2"]),
	pusher2: POS.indexOf(GATE.pusher2),
	outfeed: POS.indexOf(GATE.outfeed),
};
export const LAST = POS.length - 1;

/** Tray id m sits at position k = n - m during step n (it entered position 0 at step m). */
export const trayAt = (k, n) => n - k;

/** y of the tray at position k during the step (moving in from k-1 while the belt moves). */
export function trayY(k, u) {
	if (k <= 0) return POS[0];
	if (!moving(u)) return POS[k];
	const e = u / MOVE;
	const s = e * e * (3 - 2 * e);
	return POS[k - 1] + (POS[k] - POS[k - 1]) * s;
}

// ---------------------------------------------------------------------------
// What each tray holds. A station adds its items during its work window, one item at each
// PLACE time (seconds into the work window); station animations must land items at these times.

export const PLACE = {
	grapes: [2.0], // one bunch
	"apples-a": [2.3, 5.2], // slices 1-2
	"apples-b": [2.3, 5.2], // slices 3-4
	crackers: [1.3], // one pack
	"cheese-a": [1.2, 2.6], // two firm wedges
	"cheese-b": [1.2, 3.4], // a firm wedge, then the brie
	lidding: [1.8], // lid placed and pressed
	coder: [0.8], // label applied
};

/** Rejects, so both rework tables see traffic (the design assumes 2% and 1%; shown more often). */
export const isReject1 = (m) => ((m % 17) + 17) % 17 === 5; // short one cheese wedge (brie missing)
export const isReject2 = (m) => ((m % 29) + 29) % 29 === 11; // lid not seated

const count = (k, u, pos, times) => {
	if (k < pos) return 0;
	if (k > pos) return times.length;
	const w = work(u);
	return times.filter((t) => w >= t).length;
};

/**
 * Contents of tray m at position k, u seconds into the step. Returns null when the tray is not on
 * the conveyor (pushed to a rework lane, or lifted by the gantry).
 */
export function contents(m, k, u) {
	const c = {};
	if (k >= P.grapes) c.grapes = count(k, u, P.grapes, PLACE.grapes) > 0;
	const apples = count(k, u, P["apples-a"], PLACE["apples-a"]) + count(k, u, P["apples-b"], PLACE["apples-b"]);
	if (apples) c.apples = apples;
	if (count(k, u, P.crackers, PLACE.crackers)) c.crackers = true;
	let cheese = count(k, u, P["cheese-a"], PLACE["cheese-a"]) + count(k, u, P["cheese-b"], PLACE["cheese-b"]);
	if (isReject1(m) && cheese > 3) cheese = 3;
	if (cheese) c.cheese = cheese;
	if (count(k, u, P.lidding, PLACE.lidding)) c.lid = true;
	if (count(k, u, P.coder, PLACE.coder)) c.code = true;
	if (c.lid && isReject2(m)) c.lidOff = true;
	// The camera's verdict shows from mid-way through its work window until the pusher acts.
	if (k === P["inspect-1"] && work(u) > 1.5) c[isReject1(m) ? "fail" : "pass"] = 1;
	if (k === P["inspect-2"] && work(u) > 1.5) c[isReject2(m) ? "fail" : "pass"] = 2;
	// Gone: pushed off at the pusher (during its work window) or after.
	if (isReject1(m) && (k > P.pusher1 || (k === P.pusher1 && work(u) > 1.0))) return null;
	if (isReject2(m) && (k > P.pusher2 || (k === P.pusher2 && work(u) > 1.0))) return null;
	if (k === P.outfeed && work(u) > GANTRY_LIFT) return null;
	return c;
}

/** When, in the outfeed's work window, the gantry lifts the tray off the conveyor end. */
export const GANTRY_LIFT = 0.9;

/** How many plates have reached the carts by step n (each good tray reaching the outfeed counts). */
export function platesOut(n, u) {
	let total = 0;
	const last = n - P.outfeed; // tray at the outfeed now
	for (let m = 0; m <= last; m++) if (!isReject1(m) && !isReject2(m)) total += m < last || work(u) > GANTRY_LIFT + 2.6 ? 1 : 0;
	return total;
}
