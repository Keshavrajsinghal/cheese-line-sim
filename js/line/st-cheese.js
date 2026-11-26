// Cheese station (design 1.5): four cheeses, each in its own lane. Wedges come in single-cheese
// trays (400 x 300 mm, 12 wedges in a 4 x 3 grid), colour-coded and barcoded per cheese; Operator 1
// loads stacks of 20 into each lane's magazine from the supply aisle, where a scanner reads every
// tray. The bottom tray is fed forward to the pick position, where a camera images it as it arrives
// (every wedge there, and its angle); empty trays drop to the return level and stack under the
// magazine for the wash. Two 4-axis deltas each reach their two lanes and the plate: robot A places
// the two firm bottom wedges, robot B a firm wedge and then the brie (its own softer cup, carried
// at half speed) on top, partly on the cracker pack. Drawing code only; no text.

import { shade } from "../engine/iso.js";
import { CYCLE, isReject1, MOVE, P, PLACE } from "./clock.js";
import { clamp01, ease, lerp, object, PAL } from "./common.js";
import { drawWedge, frame, SPOT } from "./food.js";
import { BELT_Z, GUARD, HEADING, LINE_X, STATION, STOP_Y } from "./layout.js";
import { level } from "./schedule.js";
import { CUPS, cupDrop, DELTA, drawCheeseDelta } from "./st-cheese-delta.js";

const ST = STATION.cheese;
const LANES = ST.lanes;
/** Supply tray (2.5x of 400 x 300 mm): long side along x. Stack pitch per full tray. */
const TRAY = { len: 1.0, wid: 0.75, base: 0.014, rim: 0.05, pitch: 0.055 };
const MAG = { x0: GUARD.back + 0.15, x1: GUARD.back + 1.15 };
const MAG_C = (MAG.x0 + MAG.x1) / 2;
const PRES = { x0: 9.35, x1: 10.35 }; // pick position, under the delta
const PRES_C = (PRES.x0 + PRES.x1) / 2;
const LANE_END = 10.42;
const TOP_Z = 0.76; // roller top: supply tray bottom
const LOW_Z = 0.3; // return level for empty trays
const WEDGE_TOP = TOP_Z + TRAY.base + 0.045;
/** C-frame the deltas hang from: posts in the gaps between lanes, beams cantilevered over the belt. */
const FRAME = { x0: 8.95, x1: 11.05, y0: ST.y0, y1: ST.y1 - 0.15, z: DELTA.topZ, b: 0.14 };
const POST_Y = [(LANES[0] + LANES[1]) / 2, (LANES[2] + LANES[3]) / 2];
const CAM = { x: 8.94, z: 2.36 };
const SWAP = 5.0; // seconds to drop an empty tray and feed the next full one
const LANE_PHASE = [0, 5, 9, 2]; // so the four lanes change trays at different times

// Each delta hangs between its two lanes, where its reach (about 1.1 m across, at drawing scale)
// covers both supply trays and the plate's wedge spots.
const ROBOTS = [
	{ id: "A", stop: "cheese-a", c: [10.3, POST_Y[0]], lanes: [0, 1], spots: [0, 1], cups: CUPS.single },
	{ id: "B", stop: "cheese-b", c: [10.3, POST_Y[1]], lanes: [2, 3], spots: [2, 3], cups: CUPS.pair },
];
const BRIE_LANE = 3;
// Firm wedge: touch 0.81 s before the release. Brie: touch 1.45 s before, after the firm release.
const FIRM_TOUCH = 0.81;
const BRIE_TOUCH = 1.45;

const mod = (a, b) => ((a % b) + b) % b;
const near = (a, ref) => ref + mod(a - ref + Math.PI, Math.PI * 2) - Math.PI;
const hash = (a, b) => {
	const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
	return x - Math.floor(x);
};

function keyed(t, frames) {
	if (t <= frames[0][0]) return frames[0][1];
	for (let i = 1; i < frames.length; i++) {
		const [t1, v1] = frames[i];
		if (t <= t1) {
			const [t0, v0] = frames[i - 1];
			const k = ease((t - t0) / (t1 - t0 || 1));
			return v0.map((a, j) => lerp(a, v1[j], k));
		}
	}
	return frames[frames.length - 1][1];
}

// ---------------------------------------------------------------------------
// Lanes: which supply tray is presented, how many wedges it has left, and tray changes.

const placeT = (R, e) => Math.floor(e / 2) * CYCLE + MOVE + PLACE[R.stop][mod(e, 2)];
/** Robot for each lane, and which of its two events serves the lane. */
const LANE_ROBOT = [0, 1, 2, 3].map((L) => {
	const R = ROBOTS.find((q) => q.lanes.includes(L));
	return { R, i: R.lanes.indexOf(L) };
});
/** Touch time in step n for lane L's wedge. */
function touchT(L, n) {
	const { R, i } = LANE_ROBOT[L];
	const tp = placeT(R, 2 * n + i);
	return L === BRIE_LANE ? tp - BRIE_TOUCH : tp - FIRM_TOUCH;
}
/** The tray that gets no brie (clock.js isReject1) is the step where robot B's brie pick misses. */
const hasPick = (L, n) => L !== BRIE_LANE || !isReject1(n - P["cheese-b"]);
const missCount = [0];
function missesBefore(n) {
	if (n <= 0) return 0;
	while (missCount.length <= n) {
		const k = missCount.length - 1;
		missCount.push(missCount[k] + (hasPick(BRIE_LANE, k) ? 0 : 1));
	}
	return missCount[n];
}
/** Wedges taken from lane L before step n (offset per lane). */
const takenBefore = (L, n) => n + LANE_PHASE[L] - (L === BRIE_LANE ? missesBefore(n) : 0);

function laneState(L, t) {
	const n = Math.floor(t / CYCLE);
	let K = takenBefore(L, n);
	let last = null;
	if (hasPick(L, n) && t >= touchT(L, n)) {
		K += 1;
		last = touchT(L, n);
	} else
		for (let k = n - 1; k >= n - 2; k--)
			if (hasPick(L, k)) {
				last = touchT(L, k);
				break;
			}
	const used = mod(K, 12);
	const swap = used === 0 && last !== null && t - last < SWAP ? (t - last) / SWAP : null;
	return { tray: Math.floor(K / 12), used, swap };
}

/** Wedge k of a tray centered at (cx, cy): front column first, so the tray empties toward the back. */
function wedgeAt(cx, cy, L, tray, k) {
	const c = 3 - Math.floor(k / 3);
	const rr = 2 - (k % 3);
	return { x: cx - 0.375 + c * 0.25, y: cy - 0.24 + rr * 0.24, rot: Math.PI / 2 + (hash(tray * 12 + k, L + 1) - 0.5) * 0.7 };
}
const DRAW_ORDER = Array.from({ length: 12 }, (_, k) => k).sort((a, b) => {
	const p = wedgeAt(0, 0, 0, 0, a);
	const q = wedgeAt(0, 0, 0, 0, b);
	return p.x + p.y - (q.x + q.y);
});

function drawSupplyTray(r, cx, cy, z, L, tray, used, alpha) {
	const col = PAL.cheeseTray[L];
	const o = alpha === undefined ? {} : { alpha };
	const x0 = cx - TRAY.len / 2;
	const x1 = cx + TRAY.len / 2;
	const y0 = cy - TRAY.wid / 2;
	const y1 = cy + TRAY.wid / 2;
	r.box(x0, y0, z, TRAY.len, TRAY.wid, TRAY.base, shade(col, 0.82), o);
	r.box(x0, y0, z, 0.03, TRAY.wid, TRAY.rim, col, o);
	r.box(x0, y0, z, TRAY.len, 0.03, TRAY.rim, col, o);
	if (alpha === undefined)
		for (const k of DRAW_ORDER) {
			if (k < used) continue;
			const w = wedgeAt(cx, cy, L, tray, k);
			drawWedge(r, w.x, w.y, z + TRAY.base, 1, w.rot, L);
		}
	r.box(x1 - 0.03, y0, z, 0.03, TRAY.wid, TRAY.rim, col, o);
	r.box(x0, y1 - 0.03, z, TRAY.len, 0.03, TRAY.rim, col, o);
	if (alpha === undefined) barcode(r, x0 + 0.3, y1, z + 0.008);
}

/** A white barcode label on a tray's +y side. */
function barcode(r, x, y, z) {
	r.quad([[x, y + 0.002, z], [x + 0.26, y + 0.002, z], [x + 0.26, y + 0.002, z + 0.038], [x, y + 0.002, z + 0.038]], "#ffffff", { flat: true });
	for (let i = 0; i < 7; i++) {
		const bx = x + 0.03 + i * 0.03 + (i % 3) * 0.004;
		r.line([bx, y + 0.003, z + 0.008], [bx, y + 0.003, z + 0.03], "#22262c", i % 2 ? 0.8 : 1.4);
	}
}

// ---------------------------------------------------------------------------
// Static parts

function laneConveyor(r, yl, x0, x1, withEnd) {
	const ya = yl - 0.43;
	const yb = yl + 0.43;
	for (const lx of [x0 + 0.1, x1 - 0.14]) for (const ly of [ya, yb - 0.06]) r.box(lx, ly, 0, 0.06, 0.06, TOP_Z - 0.06, PAL.steelDark);
	// Return level: empty trays ride back under the magazine to the stacker.
	r.box(x0, ya, LOW_Z - 0.06, x1 - x0, 0.05, 0.06, PAL.steelDark);
	for (let x = x0 + 0.1; x < x1; x += 0.25) r.line([x, ya + 0.05, LOW_Z - 0.01], [x, yb - 0.05, LOW_Z - 0.01], "#8e98a4", 1.4);
	r.box(x0, yb - 0.05, LOW_Z - 0.06, x1 - x0, 0.05, 0.06, PAL.steelDark);
	// Feed level: side frames and rollers.
	r.box(x0, ya, TOP_Z - 0.09, x1 - x0, 0.05, 0.1, PAL.steel);
	for (let x = x0 + 0.06; x < x1; x += 0.125) r.line([x, ya + 0.05, TOP_Z - 0.005], [x, yb - 0.05, TOP_Z - 0.005], "#9aa5b1", 1.6);
	r.box(x0, yb - 0.05, TOP_Z - 0.09, x1 - x0, 0.05, 0.1, PAL.steel);
	if (withEnd) {
		r.box(x1 - 0.05, ya + 0.05, TOP_Z - 0.02, 0.05, yb - ya - 0.1, 0.1, PAL.steelDark);
		// Lift that drops each empty tray to the return level.
		r.box(x1 - 0.3, yl - 0.08, LOW_Z, 0.16, 0.16, TOP_Z - LOW_Z - 0.1, "#55616d");
	}
}

/** A frame post with the brace under its cantilevered cross beam. */
function framePost(r, py) {
	const { x0, z, b } = FRAME;
	r.box(x0 - b / 2 - 0.04, py - b / 2 - 0.04, 0, b + 0.08, b + 0.08, 0.03, PAL.steelDark);
	r.box(x0 - b / 2, py - b / 2, 0, b, b, z + b, PAL.steel);
	r.beam([x0 + b / 2, py, z - 0.75], [x0 + 0.95, py, z], 0.07, 0.07, PAL.steel);
}

/** The frame's back beam along y, with one camera over each lane's pick position. */
function backBeam(r, y0, y1) {
	const { x0, z, b } = FRAME;
	r.box(x0 - b / 2, y0, z, b, y1 - y0, b, PAL.steel, { top: "#cfd6dc" });
	for (const yl of LANES) {
		if (yl < y0 || yl >= y1) continue;
		r.box(CAM.x - 0.02, yl - 0.03, CAM.z + 0.14, 0.05, 0.06, z - CAM.z - 0.14, PAL.steelDark);
		r.box(CAM.x - 0.08, yl - 0.08, CAM.z, 0.16, 0.16, 0.16, PAL.dark);
		r.cylinder(CAM.x + 0.02, yl, CAM.z - 0.05, 0.06, 0.05, "#e9edf0", 10);
		r.cylinder(CAM.x + 0.02, yl, CAM.z - 0.07, 0.035, 0.03, "#111418", 8);
	}
}

// ---------------------------------------------------------------------------
// Animated parts

function drawMagazine(r, L, lvl, t) {
	const yl = LANES[L];
	const { x0, x1 } = MAG;
	const ya = yl - 0.43;
	const yb = yl + 0.43;
	const col = PAL.cheeseTray[L];
	const post = (x, y) => r.box(x - 0.025, y - 0.025, 0, 0.05, 0.05, 1.95, PAL.steel);
	post(x0, ya);
	post(x1, ya);
	post(x0, yb);
	// Stacker for empties under the magazine (collected by Operator 1 for the wash).
	r.box(x0, ya, 0.06, x1 - x0, yb - ya, 0.04, PAL.steelDark);
	const empties = Math.min(6, Math.round(((1 - lvl) / 0.8) * 6));
	for (let i = 0; i < empties; i++) r.box(x0 + 0.01, yl - TRAY.wid / 2, 0.1 + i * 0.03, TRAY.len - 0.02, TRAY.wid, 0.028, shade(col, i % 2 ? 1.08 : 1.0));
	r.box(x0, ya, LOW_Z - 0.06, x1 - x0, 0.05, 0.06, PAL.steelDark);
	r.box(x0, ya, TOP_Z - 0.09, x1 - x0, 0.05, 0.1, PAL.steel);
	// The stack of full trays: about 20 when loaded.
	const N = Math.max(1, Math.round(lvl * 20));
	const h = N * TRAY.pitch;
	const hb = h - TRAY.pitch + TRAY.base; // top tray's floor
	const sx0 = x0 + 0.01;
	const sx1 = x1 - 0.01;
	const sy0 = yl - TRAY.wid / 2;
	const sy1 = yl + TRAY.wid / 2;
	r.box(sx0, sy0, TOP_Z, sx1 - sx0, TRAY.wid, hb, col, { top: shade(col, 0.82) });
	const seam = shade(col, 0.7);
	for (let i = 1; i < N; i++) {
		const z = TOP_Z + i * TRAY.pitch;
		r.polyline([[sx1, sy0, z], [sx1, sy1, z], [sx0, sy1, z]], seam, 1);
	}
	r.box(sx0, sy0, TOP_Z + hb, 0.03, TRAY.wid, TRAY.rim - TRAY.base, col);
	r.box(sx0, sy0, TOP_Z + hb, sx1 - sx0, 0.03, TRAY.rim - TRAY.base, col);
	if (r.zoom >= 1)
		for (const k of DRAW_ORDER) {
			const w = wedgeAt(MAG_C, yl, L, -1 - N, k);
			drawWedge(r, w.x, w.y, TOP_Z + hb, 1, w.rot, L);
		}
	r.box(sx1 - 0.03, sy0, TOP_Z + hb, 0.03, TRAY.wid, TRAY.rim - TRAY.base, col);
	r.box(sx0, sy1 - 0.03, TOP_Z + hb, sx1 - sx0, 0.03, TRAY.rim - TRAY.base, col);
	barcode(r, sx0 + 0.3, sy1, TOP_Z + 0.008);
	r.box(x0, yb - 0.05, TOP_Z - 0.09, x1 - x0, 0.05, 0.1, PAL.steel);
	r.box(x0, yb - 0.05, LOW_Z - 0.06, x1 - x0, 0.05, 0.06, PAL.steelDark);
	post(x1, yb);
	// Barcode scanner beside the magazine, reading each tray as it is fed: the wrong cheese can't
	// be loaded into this lane.
	const sx = x1 - 0.28;
	const sy = yb + 0.13;
	r.box(sx - 0.025, sy - 0.025, 0, 0.05, 0.05, 0.92, PAL.steelDark);
	const a = 0.3 + 0.18 * Math.sin(t * 9 + L);
	r.quad([[sx, sy - 0.06, 0.95], [sx0 + 0.3, sy1 + 0.003, TOP_Z + 0.027], [sx0 + 0.56, sy1 + 0.003, TOP_Z + 0.027]], "#ff3b30", { alpha: a * 0.6, flat: true });
	r.line([sx0 + 0.3, sy1 + 0.004, TOP_Z + 0.027], [sx0 + 0.56, sy1 + 0.004, TOP_Z + 0.027], "#ff3b30", 1.6);
	r.box(sx - 0.06, sy - 0.08, 0.92, 0.12, 0.1, 0.1, "#2b2f36");
	r.box(sx - 0.04, sy - 0.085, 0.94, 0.08, 0.01, 0.04, "#ff6b5e");
}

function drawLane(r, L, t) {
	const st = laneState(L, t);
	const yl = LANES[L];
	if (st.swap === null) {
		drawSupplyTray(r, PRES_C, yl, TOP_Z, L, st.tray, st.used);
		return;
	}
	const p = st.swap;
	// The empty tray drops away to the return level...
	if (p < 0.2) drawSupplyTray(r, PRES_C, yl, TOP_Z - 0.12 * ease(p / 0.2), L, st.tray - 1, 12, 1 - p / 0.2);
	// ...and the next full tray is fed from the bottom of the magazine.
	if (p > 0.1) drawSupplyTray(r, lerp(MAG_C + 0.5, PRES_C, ease(clamp01((p - 0.1) / 0.6))), yl, TOP_Z, L, st.tray, 0);
	// The camera images the new tray as it arrives.
	if (p > 0.72 && p < 0.86) {
		const a = Math.sin(((p - 0.72) / 0.14) * Math.PI);
		const z = WEDGE_TOP + 0.005;
		const corners = [
			[PRES.x0, yl - TRAY.wid / 2, z],
			[PRES.x1, yl - TRAY.wid / 2, z],
			[PRES.x1, yl + TRAY.wid / 2, z],
			[PRES.x0, yl + TRAY.wid / 2, z],
		];
		r.quad(corners, "#ffffff", { alpha: 0.35 * a, flat: true });
		for (const c of corners) r.line([CAM.x + 0.02, yl, CAM.z - 0.07], c, `rgba(255,255,255,${(0.7 * a).toFixed(3)})`, 1);
	}
}

// ---------------------------------------------------------------------------
// Robots

/** Plate spot for robot R's i-th wedge: lip (top of the wedge), rotation, cheese kind. */
const PLACES = ROBOTS.map((R) =>
	R.spots.map((j) => {
		const w = SPOT.cheese[j];
		const a = frame(LINE_X, STOP_Y[R.stop], BELT_Z, HEADING, 1)(w.f, w.sd, 0.052 + w.layer * 0.04);
		return { lip: [a[0], a[1], a[2] + 0.045], rot: HEADING + w.rot, kind: w.kind };
	}),
);

/** Robot R's pose at line time t: platform, tool angle, cup extensions, and the held wedge. */
function deltaPose(R, ri, t) {
	let e = 2 * Math.floor(t / CYCLE);
	while (t >= placeT(R, e)) e++;
	const n = Math.floor(e / 2);
	const i = mod(e, 2);
	const L = R.lanes[i];
	const brie = L === BRIE_LANE;
	const tq = placeT(R, e - 1);
	const tp = placeT(R, e);
	const tk = tp - (brie ? BRIE_TOUCH : FIRM_TOUCH);
	const prevLane = R.lanes[1 - i];
	const prev = PLACES[ri][1 - i];
	const next = PLACES[ri][i];
	const K = takenBefore(L, n);
	const w = wedgeAt(PRES_C, LANES[L], L, Math.floor(K / 12), mod(K, 12));
	const ok = hasPick(L, n);
	// Pose values: [x, y, z, theta, ext per cup]; keyframes are given by the lip of the cup in use.
	const cupOf = (lane) => (R.cups.length > 1 && lane === BRIE_LANE ? 1 : 0);
	const at = (lip, dz, theta, cup) => {
		const c = R.cups[cup];
		const ext = R.cups.map((_, j) => (j === cup ? 1 : 0));
		return [lip[0] - Math.cos(theta) * c.off, lip[1] - Math.sin(theta) * c.off, lip[2] + dz + cupDrop(1), theta, ...ext];
	};
	const th0 = prev.rot;
	const thP = near(w.rot, th0);
	const thQ = near(next.rot, thP);
	const P0 = [w.x, w.y, WEDGE_TOP];
	const c0 = cupOf(prevLane);
	const c1 = cupOf(L);
	const frames = [[tq, at(prev.lip, 0, th0, c0)]];
	let hover = tq + 0.4;
	if (prevLane === BRIE_LANE) {
		// After the brie: a slow pull-away so it doesn't stick to the cup.
		frames.push([tq + 0.25, at(prev.lip, 0.08, th0, c0)], [tq + 0.4, at(prev.lip, 0.25, th0, c0)]);
		hover = tq + 0.75;
	} else frames.push([tq + 0.1, at(prev.lip, 0.2, th0, c0)]);
	if (brie) {
		frames.push(
			[tq + 0.45, at(P0, 0.3, thP, c1)],
			[tk - 0.15, at(P0, 0.08, thP, c1)],
			[tk, at(P0, 0, thP, c1)], // slow touch
			[tk + 0.25, at(P0, 0, thP, c1)], // vacuum builds (the rind leaks)
			[tk + 0.45, at(P0, 0.06, thP, c1)], // slow lift-off
			[tk + 0.57, at(P0, 0.3, thP, c1)],
			[tp - 0.45, at(next.lip, 0.25, thQ, c1)], // carried at half speed
			[tp - 0.3, at(next.lip, 0.06, thQ, c1)],
			[tp - 0.08, at(next.lip, 0.008, thQ, c1)], // slow set-down onto the layer below
			[tp, at(next.lip, 0, thQ, c1)], // longer puff of air
		);
	} else {
		frames.push(
			[hover, at(P0, 0.3, thP, c1)],
			[Math.max(hover, tk - 0.18), at(P0, 0.3, thP, c1)],
			[tk - 0.08, at(P0, 0.05, thP, c1)],
			[tk, at(P0, 0, thP, c1)],
			[tk + 0.08, at(P0, 0, thP, c1)],
			[tk + 0.18, at(P0, 0.06, thP, c1)],
			[tk + 0.26, at(P0, 0.3, thP, c1)],
			[tp - 0.26, at(next.lip, 0.25, thQ, c1)],
			[tp - 0.12, at(next.lip, 0.04, thQ, c1)],
			[tp, at(next.lip, 0, thQ, c1)],
		);
	}
	const v = keyed(t, frames);
	return { plat: [v[0], v[1], v[2]], theta: v[3], ext: v.slice(4), held: ok && t >= tk ? { kind: next.kind, cup: c1 } : null };
}

export function build(scene, ctx, T) {
	const g = ctx.group;
	// Lane conveyors (static), magazines and presented trays (animated).
	LANES.forEach((yl, L) => {
		const cut = 9.1;
		object(scene, MAG.x1, yl - 0.45, cut, yl + 0.45, TOP_Z + 0.02, (r) => laneConveyor(r, yl, MAG.x1, cut, false), { group: g });
		object(scene, cut, yl - 0.45, LANE_END, yl + 0.45, TOP_Z + 0.02, (r) => laneConveyor(r, yl, cut, LANE_END, true), { group: g });
		scene.addDynamic({
			group: g,
			depth: MAG_C + yl,
			bounds: [MAG.x0 - 0.05, yl - 0.5, 0, MAG.x1 + 0.05, yl + 0.6, 1.95],
			animated: () => true,
			draw: (r, t0) => {
				const t = T(t0);
				drawMagazine(r, L, level(`cheese-${L + 1}`, t), t);
			},
		});
		scene.addDynamic({
			group: g,
			depth: PRES_C + yl + 0.05,
			bounds: [MAG.x0, yl - 0.45, LOW_Z, LANE_END, yl + 0.45, CAM.z],
			animated: () => true,
			draw: (r, t0) => drawLane(r, L, T(t0)),
		});
	});

	// Delta frame: back beam with the cameras, and posts that stand between two lanes (each sorts
	// after the lane behind it and before the lane in front).
	const { x0, x1, y0, y1, z, b } = FRAME;
	const ym = (y0 + y1) / 2;
	object(scene, x0 - b, y0, x0 + b, ym, z + b, (r) => backBeam(r, y0, ym), { group: g });
	object(scene, x0 - b, ym, x0 + b, y1, z + b, (r) => backBeam(r, ym, y1), { group: g });
	for (const py of POST_Y) object(scene, x0 - b, py - b, x0 + 1, py + b, z + b, (r) => framePost(r, py), { group: g, depth: (MAG.x1 + 9.1) / 2 + py });

	ROBOTS.forEach((R, ri) => {
		const [cx, cy] = R.c;
		scene.addDynamic({
			group: g,
			depth: LINE_X + STOP_Y[R.stop] + 0.15,
			bounds: [x0, cy - 1.5, 0.7, LINE_X + 0.45, cy + 1.5, z + b],
			animated: () => true,
			draw: (r, t0) => {
				const t = T(t0);
				const { plat, theta, ext, held } = deltaPose(R, ri, t);
				drawCheeseDelta(r, cx, cy, plat, theta, R.cups, ext, {
					// The cross beam the delta hangs from.
					mount: (rr) => rr.box(x0, cy - b / 2, z, x1 - x0, b, b, PAL.steel, { top: "#cfd6dc" }),
					held: held
						? (rr) => {
								const off = R.cups[held.cup].off;
								drawWedge(rr, plat[0] + Math.cos(theta) * off, plat[1] + Math.sin(theta) * off, plat[2] - cupDrop(ext[held.cup]) - 0.045, 1, theta, held.kind);
							}
						: null,
				});
			},
		});
	});
}
