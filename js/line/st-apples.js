// Apple station (design 1.3): Operator 1 tips prepped slices into a small hopper through the back
// guard opening; a vibratory shaker spreads them into a single layer on a slow pick belt that runs
// alongside the tray belt past both robots; a 2D camera upstream finds single, flat slices and their
// skin side, and an encoder on the pick belt tracks each one, so the robots pick on the move.
// Two hygienic six-axis arms with oval bellows cups stand each slice upright, tilting it during
// the carry: robot A places slices 1-2, robot B slices 3-4 at the next stop. Unpicked slices ride
// off the end into a return tote. Drawing code only; no text.

import { CYCLE, MOVE, PLACE } from "./clock.js";
import { ease, lerp, object, PAL } from "./common.js";
import { drawSlice, frame, SPOT } from "./food.js";
import { BELT_Z, HEADING, LINE_X, STATION, STOP_Y } from "./layout.js";
import { level } from "./schedule.js";
import { ARM, drawCupArm, drawPlinth } from "./st-apples-arm.js";

const ST = STATION.apples;
const HALF_PI = Math.PI / 2;

/** Pick belt (along y, past both robots), its surface height, and the three slice lanes across it. */
const PB = { x0: ST.pickBelt[0], x1: ST.pickBelt[1], y0: 12.55, y1: 17.35, z: BELT_Z };
const BELT_COLOR = PAL.beltBlue;
const LANE_X = [PB.x0 + 0.145, (PB.x0 + PB.x1) / 2, PB.x1 - 0.145];
// Slices arrive in rows across the belt, half a step apart. Robot A meets a row at PICK_Y; the
// same row reaches robot B 0.6 m (one step) later, so B's event e picks the row of A's event
// e - LAG. A row passes PICK_Y at r * ROW_T + PHI.
const ROW_T = CYCLE / 2;
const V = 0.6 / CYCLE; // slow pick belt: 0.3 m between rows
const PICK_Y = 14.85;
const LAG = 2;
const PHI = 0.97;
const Y_DROP = 13.22; // where slices land from the shaker, just inside the camera hood
const VC = 0.42 * 0.085; // a slice's face center, from its straight cut edge
const PICK_AFTER_RELEASE = 1.25; // seconds from a release to the next touch on the pick belt

/** Hopper (filled from the aisle through the back guard opening) and its outlet onto the shaker. */
const HOP = { x0: ST.hopper[0] + 0.15, x1: ST.hopper[1] - 0.05, y0: 12.62, y1: 14.45, zb: 1.25, zr: 1.6 };
const OUT = { x0: 6.55, x1: 6.95, y0: 12.72, y1: 13.08, z: 1.1 };
/** Vibratory shaker pan: from under the hopper to a wide spreading end over the pick belt start. */
const PAN = { x0: 6.4, x1: PB.x1 + 0.05, y0: 12.62, y1: 13.18, z0: 1.02, z1: 0.96 };
const HOOD = { x0: PB.x0 - 0.07, x1: PB.x1 + 0.07, y0: 13.22, y1: 13.56, z: PB.z + 0.42 };
const ENC = { x: PB.x1 + 0.08, y: 13.95 };
const TOTE = { x0: PB.x0 - 0.02, x1: PB.x1 + 0.02, y0: PB.y1 - 0.1, y1: PB.y1 + 0.55, z: 0.3, h: 0.3 };

const ROBOTS = [
	{ id: "A", stop: "apples-a", base: ST.robotA, first: 0, lag: 0 },
	{ id: "B", stop: "apples-b", base: ST.robotB, first: 2, lag: LAG },
];

const mod = (a, b) => ((a % b) + b) % b;
const add = (p, d, k = 1) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const wrapPi = (a) => mod(a + Math.PI, Math.PI * 2) - Math.PI;
const hash = (a, b) => {
	const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** Keyframed pose: frames [[time, [values...]], ...], eased between neighbors. */
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
// Slice geometry: a slice is posed by its face center, `along` (its straight edge's direction) and
// `tilt` (PI/2 lying flat, 0 standing), as in food.js drawSlice.

/** In-plane up direction of a slice (from its straight edge toward the skin). */
const upVec = (along, tilt) => [-Math.sin(along) * Math.sin(tilt), Math.cos(along) * Math.sin(tilt), Math.cos(tilt)];
/** Normal of the face the cup holds (up when the slice lies flat). */
const normalOf = (along, tilt) => [Math.sin(along) * Math.cos(tilt), -Math.cos(along) * Math.cos(tilt), Math.sin(tilt)];

function sliceAt(r, c, along, tilt) {
	const w = upVec(along, tilt);
	drawSlice(r, c[0] - w[0] * VC, c[1] - w[1] * VC, c[2] - w[2] * VC, 1, along, tilt);
}

// ---------------------------------------------------------------------------
// The pick belt's slices: rows of three lanes; one slice per row for each robot, the third rides
// to the return tote (sometimes two stuck together, sometimes a gap).

function row(r) {
	const a = Math.floor(hash(r, 1) * 3);
	const b = (a + 1 + Math.floor(hash(r, 2) * 2)) % 3;
	const h = hash(r, 3);
	return { a, b, extra: h < 0.18 ? "none" : h < 0.42 ? "double" : "single" };
}
const slot = (r, j) => ({ x: LANE_X[j] + (hash(r, 10 + j) - 0.5) * 0.03, dy: (hash(r, 20 + j) - 0.5) * 0.08, along: hash(r, 30 + j) * Math.PI * 2 });
const rowY = (r, t) => PICK_Y + V * (t - (r * ROW_T + PHI));

const placeT = (R, e) => Math.floor(e / 2) * CYCLE + MOVE + PLACE[R.stop][mod(e, 2)];
const pickT = (R, e) => placeT(R, e - 1) + PICK_AFTER_RELEASE;

/** Where slice i of robot R stands in the stopped tray: cup point (face center), tilt, normal. */
const SPOTS = ROBOTS.map((R) =>
	[0, 1].map((i) => {
		const s = SPOT.apples[R.first + i];
		const a = frame(LINE_X, STOP_Y[R.stop], BELT_Z, HEADING, 1)(s.f, s.sd, 0.052);
		return { cup: add(a, upVec(HEADING, s.tilt), VC), tilt: s.tilt, N: normalOf(HEADING, s.tilt) };
	}),
);

/**
 * Pose of robot R at line time t: [x, y, z, along, tilt] of the cup (the face center of the slice
 * it holds, or would hold), and whether it holds a slice. Event e = 2n + i is the robot's i-th
 * release in step n, exactly at its PLACE time; it touches the next slice PICK_AFTER_RELEASE later,
 * matching the belt's speed while the cup is down.
 */
function armPose(R, ri, t) {
	let e = 2 * Math.floor(t / CYCLE);
	while (t >= placeT(R, e)) e++;
	const tq = placeT(R, e - 1);
	const tp = placeT(R, e);
	const tk = tq + PICK_AFTER_RELEASE;
	const prev = SPOTS[ri][mod(e - 1, 2)];
	const next = SPOTS[ri][mod(e, 2)];
	const r = e - R.lag;
	const rw = row(r);
	const s = slot(r, R.id === "A" ? rw.a : rw.b);
	const yAt = (tt) => rowY(r, tt) + s.dy;
	const a = HEADING + wrapPi(s.along - HEADING);
	const zb = PB.z + 0.003;
	const hov = 1.22;
	const pull = add(prev.cup, prev.N, 0.08);
	const above = [next.cup[0] + 0.05, next.cup[1], next.cup[2] + 0.3, HEADING, next.tilt];
	const arrive = tk + 0.95;
	const frames = [
		[tq, [...prev.cup, HEADING, prev.tilt]],
		[tq + 0.15, [...pull, HEADING, prev.tilt]], // pull straight off its face
		[tq + 0.4, [pull[0], pull[1], hov + 0.08, HEADING, prev.tilt]],
		[tk - 0.35, [s.x, yAt(tk - 0.35), hov, a, HALF_PI]],
		[tk - 0.12, [s.x, yAt(tk - 0.12), zb + 0.06, a, HALF_PI]],
		[tk, [s.x, yAt(tk), zb, a, HALF_PI]], // touch down on the cut face
		[tk + 0.15, [s.x, yAt(tk + 0.15), zb, a, HALF_PI]], // vacuum confirmed, still tracking
		[tk + 0.35, [s.x, yAt(tk + 0.35), hov, a, HALF_PI]],
		[arrive, above], // the wrist stands the slice up during the carry
		[Math.max(arrive, tp - 0.75), above], // waits here while the tray indexes in
		[tp - 0.4, [next.cup[0], next.cup[1], next.cup[2] + 0.1, HEADING, next.tilt]],
		[tp, [...next.cup, HEADING, next.tilt]], // set down leaning; release
	];
	return { p: keyed(t, frames), held: t >= tk };
}

// ---------------------------------------------------------------------------
// Static parts

function pickBeltPiece(r, y0, y1, isEnd) {
	const { x0, x1, z } = PB;
	for (const lx of [x0 + 0.03, x1 - 0.11]) r.box(lx, y0 + 0.12, 0, 0.08, 0.08, z - 0.12, PAL.steelDark);
	if (isEnd) for (const lx of [x0 + 0.03, x1 - 0.11]) r.box(lx, y1 - 0.4, 0, 0.08, 0.08, z - 0.12, PAL.steelDark);
	r.box(x0, y0, z - 0.14, x1 - x0, y1 - y0, 0.12, PAL.steel);
	r.ground(x0 + 0.04, y0, x1 - x0 - 0.08, y1 - y0, BELT_COLOR, z - 0.004);
	r.box(x0 - 0.03, y0, z - 0.06, 0.06, y1 - y0, 0.09, PAL.steelDark);
	r.box(x1 - 0.03, y0, z - 0.06, 0.06, y1 - y0, 0.09, PAL.steelDark);
	if (isEnd) {
		// Nose roller over the return tote, and the drive motor on the front side.
		r.tube([x0, y1, z - 0.05], [x1, y1, z - 0.05], 0.05, PAL.steelDark, 8);
		r.box(x1 + 0.03, y1 - 0.42, z - 0.32, 0.16, 0.3, 0.24, PAL.steel);
		r.tube([x1 + 0.19, y1 - 0.27, z - 0.2], [x1 + 0.38, y1 - 0.27, z - 0.2], 0.09, "#c4ccd4", 10);
	}
}

const panZ = (x) => lerp(PAN.z0, PAN.z1, (x - PAN.x0) / (PAN.x1 - PAN.x0));

/** One piece (x from a to b) of the vibratory shaker: pan on springs over a drive unit. */
function panPiece(r, a, b) {
	const { y0, y1 } = PAN;
	const first = a === PAN.x0;
	if (first) {
		// Drive unit on its stand, springs up to the pan.
		r.box(7.6, y0 + 0.08, 0, 0.1, 0.1, 0.62, PAL.steelDark);
		r.box(8.5, y0 + 0.08, 0, 0.1, 0.1, 0.62, PAL.steelDark);
		r.box(7.55, y0 + 0.06, 0.58, 1.1, y1 - y0 - 0.12, 0.2, PAL.steel, { top: "#cfd6dc" });
		for (const sx of [7.7, 8.5]) for (const sy of [y0 + 0.14, y1 - 0.14]) r.cylinder(sx, sy, 0.78, 0.035, panZ(sx) - 0.8, "#55616d", 6);
	} else {
		r.box(9.12, y0 + 0.1, 0, 0.08, 0.08, panZ(9.12) - 0.04, PAL.steelDark);
	}
	// Pan: underside, floor, back side, and the front lip (open where it overhangs the pick belt,
	// so the slices spill off across the belt's width).
	const za = panZ(a);
	const zb = panZ(b);
	r.quad([[a, y0, za - 0.03], [b, y0, zb - 0.03], [b, y1, zb - 0.03], [a, y1, za - 0.03]], PAL.steelDark);
	r.quad([[a, y0, za], [b, y0, zb], [b, y1, zb], [a, y1, za]], "#d5dbe0", { flat: true });
	r.quad([[a, y0, za], [b, y0, zb], [b, y0, zb + 0.08], [a, y0, za + 0.08]], PAL.steel);
	const lipEnd = Math.min(b, PB.x0 - 0.05);
	if (lipEnd > a) r.quad([[a, y1, za - 0.03], [lipEnd, y1, panZ(lipEnd) - 0.03], [lipEnd, y1, panZ(lipEnd) + 0.06], [a, y1, za + 0.06]], PAL.steel);
	if (lipEnd < b) r.line([Math.max(a, lipEnd), y1, panZ(Math.max(a, lipEnd))], [b, y1, zb], PAL.steelDark, 1.4);
	if (b === PAN.x1) r.quad([[b, y0, zb - 0.03], [b, y1, zb - 0.03], [b, y1, zb + 0.06], [b, y0, zb + 0.08]], PAL.steel);
	if (first) r.quad([[a, y0, za - 0.03], [a, y1, za - 0.03], [a, y1, za + 0.06], [a, y0, za + 0.08]], PAL.steel);
}

// ---------------------------------------------------------------------------
// Animated parts

function drawHopper(r, lvl) {
	const { x0, x1, y0, y1, zb, zr } = HOP;
	// Legs behind; the pan passes under the -y side, so those legs stand clear of it.
	r.box(x0 + 0.02, y0 + 0.02, 0, 0.07, 0.07, zb, PAL.steelDark);
	r.box(x0 + 0.02, y1 - 0.1, 0, 0.07, 0.07, zb, PAL.steelDark);
	r.box(x1 - 0.1, PAN.y1 + 0.06, 0, 0.07, 0.07, zb, PAL.steelDark);
	// Inner faces of the back walls.
	r.quad([[x0, y0, zb], [x0, y1, zb], [x0, y1, zr], [x0, y0, zr]], "#d8dee3", { flat: true });
	r.quad([[x0, y0, zb], [x1, y0, zb], [x1, y0, zr], [x0, y0, zr]], "#c9d0d6", { flat: true });
	// The slices inside, at the fill level (down in the funnel when low).
	const hz = OUT.z + 0.04 + lvl * (zr - 0.06 - OUT.z - 0.04);
	const k = Math.min(1, (hz - OUT.z) / (zb - OUT.z));
	const rx0 = lerp(OUT.x0, x0, k);
	const rx1 = lerp(OUT.x1, x1, k);
	const ry0 = lerp(OUT.y0, y0, k);
	const ry1 = lerp(OUT.y1, y1, k);
	r.groundPoly([[rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1]], "#efe2b6", hz);
	for (let i = 0; i < 9; i++) {
		const cx = lerp(rx0 + 0.1, rx1 - 0.1, hash(i, 41));
		const cy = lerp(ry0 + 0.1, ry1 - 0.1, hash(i, 42));
		sliceAt(r, [cx, cy, hz + 0.004], hash(i, 43) * 6.28, HALF_PI - 0.25 * hash(i, 44));
	}
	// Funnel and front walls.
	r.quad([[x1, y0, zb], [x1, y1, zb], [OUT.x1, OUT.y1, OUT.z], [OUT.x1, OUT.y0, OUT.z]], PAL.steel);
	r.quad([[x0, y1, zb], [x1, y1, zb], [OUT.x1, OUT.y1, OUT.z], [OUT.x0, OUT.y1, OUT.z]], PAL.steel);
	r.box(OUT.x0, OUT.y0, OUT.z - 0.04, OUT.x1 - OUT.x0, OUT.y1 - OUT.y0, 0.05, PAL.steelDark);
	r.quad([[x1, y0, zb], [x1, y1, zb], [x1, y1, zr], [x1, y0, zr]], PAL.steel);
	r.quad([[x0, y1, zb], [x1, y1, zb], [x1, y1, zr], [x0, y1, zr]], PAL.steel);
	r.polyline([[x0, y0, zr], [x1, y0, zr], [x1, y1, zr], [x0, y1, zr], [x0, y0, zr]], PAL.steelDark, 2);
	r.box(x1 - 0.1, y1 - 0.1, 0, 0.07, 0.07, zb, PAL.steelDark);
	// Level sensor on the front wall (the low-level alarm to Operator 1).
	r.box(x1, (y0 + y1) / 2 - 0.05, zb + 0.08, 0.05, 0.1, 0.1, lvl < 0.3 ? PAL.danger : PAL.ok);
}

/** Slices jostling along the shaker pan, spreading out where it overhangs the pick belt. */
function drawPanSlices(r, t) {
	for (let k = 0; k < 10; k++) {
		const s = mod(t * 0.2 + k * 0.33, 3.3);
		const yy = PAN.y0 + 0.1 + hash(k, 5) * 0.36;
		let x = 7.45 + Math.min(s, 2.0);
		let y = yy;
		if (s > 2.0) {
			x = lerp(9.45, PB.x0 + 0.1 + hash(k, 6) * (PB.x1 - PB.x0 - 0.2), Math.min(1, (s - 2.0) / 0.4));
			y = yy + Math.max(0, s - 2.2) * 0.45;
			if (y > PAN.y1 + 0.01) continue;
		}
		x += 0.005 * Math.sin(t * 47 + k * 2.1);
		sliceAt(r, [x, y, panZ(x) + 0.004], hash(k, 7) * 6.28 + 0.15 * Math.sin(t * 2.3 + k), HALF_PI);
	}
}

function drawBeltSlices(r, t) {
	// Belt seams moving with the pick belt.
	const ph = mod(V * t, 0.3);
	for (let y = PB.y0 + ph; y < PB.y1; y += 0.3) r.line([PB.x0 + 0.05, y, PB.z], [PB.x1 - 0.05, y, PB.z], "rgba(15,40,80,0.35)", 1);
	const span = (yy) => (yy - PICK_Y) / V;
	const rLo = Math.floor((t - span(PB.y1 + 0.6) - PHI) / ROW_T);
	const rHi = Math.ceil((t - span(Y_DROP - 0.1) - PHI) / ROW_T);
	for (let r0 = rHi; r0 >= rLo; r0--) {
		const yr = rowY(r0, t);
		const rw = row(r0);
		for (let j = 0; j < 3; j++) {
			const kind = j === rw.a ? "A" : j === rw.b ? "B" : rw.extra;
			if (kind === "none") continue;
			if (kind === "A" && t >= pickT(ROBOTS[0], r0)) continue;
			if (kind === "B" && t >= pickT(ROBOTS[1], r0 + LAG)) continue;
			const s = slot(r0, j);
			const y = yr + s.dy;
			if (y < Y_DROP) continue;
			let z = PB.z + 0.003;
			let tilt = HALF_PI;
			let yy = y;
			if (y > PB.y1 - 0.02) {
				// Off the end: a short fall into the return tote.
				const dt = (y - (PB.y1 - 0.02)) / V;
				if (dt > 0.34) continue;
				z -= 4.4 * dt * dt;
				yy = PB.y1 - 0.02 + 0.5 * dt;
				tilt = HALF_PI - dt * 2.5;
			}
			sliceAt(r, [s.x, yy, z], s.along, tilt);
			if (kind === "double") sliceAt(r, [s.x + 0.03, yy + 0.035, z + 0.006], s.along + 0.7, tilt);
		}
	}
}

function drawHood(r) {
	const { x0, x1, y0, y1, z } = HOOD;
	// Encoder: a measuring wheel riding on the pick belt's edge (counts belt travel), on a bracket
	// bolted to the belt frame.
	r.box(PB.x1 + 0.03, ENC.y - 0.04, PB.z - 0.1, ENC.x - PB.x1, 0.08, 0.04, PAL.steelDark);
	r.box(ENC.x - 0.04, ENC.y - 0.07, PB.z - 0.08, 0.1, 0.14, 0.12, PAL.dark);
	r.tube([PB.x1 - 0.07, ENC.y, PB.z + 0.05], [ENC.x - 0.04, ENC.y, PB.z + 0.05], 0.05, "#55616d", 10);
	// Camera hood over the belt: back panel, light bar, front panel (clear), housing, camera.
	r.quad([[x0, y0, PB.z - 0.05], [x0, y1, PB.z - 0.05], [x0, y1, z], [x0, y0, z]], PAL.steel);
	r.box(x0 + 0.05, (y0 + y1) / 2 - 0.04, z - 0.06, x1 - x0 - 0.1, 0.08, 0.04, "#fff6c8");
	r.quad([[x1, y0, PB.z - 0.02], [x1, y1, PB.z - 0.02], [x1, y1, z], [x1, y0, z]], PAL.guardPanel, { alpha: 0.45, edge: "rgba(120,150,170,0.6)" });
	r.box(x0, y0, z, x1 - x0, y1 - y0, 0.1, "#2f6fb3", { top: "#3d7fd1" });
	const cx = (x0 + x1) / 2;
	const cy = (y0 + y1) / 2;
	r.box(cx - 0.09, cy - 0.08, z + 0.1, 0.18, 0.16, 0.14, PAL.dark);
	r.cylinder(cx + 0.09, cy, z + 0.13, 0.03, 0.05, "#111418", 8);
}

function drawTote(r, lvl) {
	const { x0, x1, y0, y1, z, h } = TOTE;
	const c = "#e9edf0";
	const t = 0.03;
	// Tote on a stainless stand under the belt's end.
	r.box(x0 - 0.03, y0 - 0.03, 0.03, x1 - x0 + 0.06, y1 - y0 + 0.06, 0.04, PAL.steelDark);
	for (const [lx, ly] of [[x0, y0], [x1 - 0.05, y0], [x0, y1 - 0.05], [x1 - 0.05, y1 - 0.05]]) r.box(lx, ly, 0.07, 0.05, 0.05, z - 0.09, PAL.steel);
	r.box(x0 - 0.02, y0 - 0.02, z - 0.03, x1 - x0 + 0.04, y1 - y0 + 0.04, 0.03, PAL.steel);
	r.box(x0, y0, z, x1 - x0, y1 - y0, 0.02, "#c9d0d6");
	r.box(x0, y0, z, t, y1 - y0, h, c);
	r.box(x0, y0, z, x1 - x0, t, h, c);
	// Returned slices pile up until Operator 1 tips them back into the hopper (with the refill).
	const n = 6 + Math.round(((1 - lvl) / 0.8) * 16);
	for (let i = 0; i < n; i++) {
		const cx = lerp(x0 + 0.12, x1 - 0.12, hash(i, 61));
		const cy = lerp(y0 + 0.12, y1 - 0.12, hash(i, 62));
		sliceAt(r, [cx, cy, z + 0.04 + i * 0.01], hash(i, 63) * 6.28, HALF_PI - 0.3 * hash(i, 64));
	}
	r.box(x1 - t, y0, z, t, y1 - y0, h, c);
	r.box(x0, y1 - t, z, x1 - x0, t, h, c);
}

export function build(scene, ctx, T) {
	const g = ctx.group;
	// Static: pick belt, shaker, robot pedestals.
	const cuts = [PB.y0, 14.15, 15.75, PB.y1];
	for (let i = 0; i < cuts.length - 1; i++) {
		const a = cuts[i];
		const b = cuts[i + 1];
		object(scene, PB.x0 - 0.05, a, PB.x1 + 0.45, b, PB.z + 0.05, (r) => pickBeltPiece(r, a, b, i === cuts.length - 2), { group: g });
	}
	// The pan's far end sits over the pick belt, so it sorts after the first belt piece.
	for (const [a, b, depth] of [
		[PAN.x0, 8.3, 7.4 + 12.9],
		[8.3, PAN.x1, 9.8 + 13.4],
	])
		object(scene, a, PAN.y0, b, PAN.y1, PAN.z0 + 0.1, (r) => panPiece(r, a, b), { group: g, depth });
	for (const R of ROBOTS) {
		const [bx, by] = R.base;
		object(scene, bx - 0.36, by - 0.36, bx + 0.36, by + 0.36, ARM.plinth, (r) => drawPlinth(r, bx, by), { group: g });
	}

	// Hopper (fill level from Operator 1's schedule), slices on the shaker and on the pick belt.
	const hopDepth = (HOP.x0 + HOP.x1) / 2 + (HOP.y0 + HOP.y1) / 2;
	scene.addDynamic({
		group: g,
		depth: hopDepth,
		bounds: [HOP.x0, HOP.y0, 0, HOP.x1, HOP.y1, HOP.zr],
		animated: () => true,
		draw: (r, t0) => drawHopper(r, level("apples", T(t0))),
	});
	scene.addDynamic({
		group: g,
		depth: hopDepth + 0.3,
		bounds: [7.3, PAN.y0, PAN.z1, PAN.x1, PAN.y1, PAN.z0 + 0.1],
		animated: () => true,
		draw: (r, t0) => drawPanSlices(r, T(t0)),
	});
	// Below the hood and the arms, which pass over the belt.
	scene.addDynamic({
		group: g,
		depth: PB.x0 + Y_DROP - 0.5,
		bounds: [PB.x0, Y_DROP - 0.1, 0.4, PB.x1 + 0.05, PB.y1 + 0.3, PB.z + 0.05],
		animated: () => true,
		draw: (r, t0) => drawBeltSlices(r, T(t0)),
	});
	scene.add({ group: g, live: true, bounds: [HOOD.x0, HOOD.y0, 0, ENC.x + 0.1, ENC.y + 0.1, HOOD.z + 0.25], depth: (PB.x0 + PB.x1) / 2 + (HOOD.y0 + HOOD.y1) / 2, draw: drawHood });
	scene.addDynamic({
		group: g,
		depth: (TOTE.x0 + TOTE.x1) / 2 + (TOTE.y0 + TOTE.y1) / 2,
		bounds: [TOTE.x0 - 0.05, TOTE.y0 - 0.05, 0, TOTE.x1 + 0.05, TOTE.y1 + 0.05, TOTE.z + TOTE.h],
		animated: () => true,
		draw: (r, t0) => drawTote(r, level("apples", T(t0))),
	});

	// The two arms: each sorts just in front of the tray it serves (behind the front guard).
	ROBOTS.forEach((R, ri) => {
		const [bx, by] = R.base;
		const ty = STOP_Y[R.stop];
		scene.addDynamic({
			group: g,
			depth: LINE_X + ty + 0.2,
			bounds: [bx - 0.5, Math.min(by, ty) - 1.2, 0, LINE_X + 0.8, Math.max(by, ty) + 1.2, ARM.plinth + ARM.shoulder + ARM.L1 + 0.3],
			animated: () => true,
			draw: (r, t0) => {
				const { p, held } = armPose(R, ri, T(t0));
				const [x, y, z, along, tilt] = p;
				const N = normalOf(along, tilt);
				const axis = [Math.cos(along), Math.sin(along), 0];
				drawCupArm(r, bx, by, [x, y, z], [-N[0], -N[1], -N[2]], axis, held ? (rr) => sliceAt(rr, [x, y, z], along, tilt) : null);
			},
		});
	});
}
