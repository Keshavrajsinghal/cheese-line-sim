// Shared drawing pieces for the head of the line (denester, grapes, crackers): keyframed poses,
// a stainless washdown delta, soft finger rows, a food-grade suction cup, small sensors, and
// roller conveyor sections. Drawing code only; no text.

import { depthOf } from "../engine/iso.js";
import { ease, lerp, PAL } from "./common.js";

/** Washdown stainless colours (food zone). */
export const SS = {
	steel: PAL.steel,
	dark: PAL.steelDark,
	bright: "#d3d9df",
	body: "#e3e8ec", // delta housing and arms: smooth stainless, no pockets for water to stand in
	accent: "#a8b5c2",
	rod: "#c8cfd6",
	joint: "#59636e",
	sensor: "#2b2f36",
	silicone: "#ef8a3c", // soft fingers
	cup: "#2f78c4", // food-grade blue suction cup
};

/** Deterministic pseudo-random number in [0, 1). */
export const hash = (a, b) => {
	const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** Eased progress of w through [a, b]. */
export const seg = (w, a, b) => ease((w - a) / (b - a));

/** Keyframed pose: frames [[w, [values...]], ...], eased between neighbours. */
export function keyed(w, frames) {
	if (w <= frames[0][0]) return frames[0][1];
	for (let i = 1; i < frames.length; i++) {
		const [w1, v1] = frames[i];
		if (w <= w1) {
			const [w0, v0] = frames[i - 1];
			const k = ease((w - w0) / (w1 - w0 || 1));
			return v0.map((a, j) => lerp(a, v1[j], k));
		}
	}
	return frames[frames.length - 1][1];
}

/** Floor modulo. */
export const mod = (a, m) => ((a % m) + m) % m;

// ---------------------------------------------------------------------------
// Delta robot (4-axis, washdown): hexagonal housing, three upper arms, parallel rod pairs,
// platform, and the telescoping fourth-axis shaft that turns the tool. Proportions follow
// js/engine/robots.js drawDelta; the tool is drawn by the caller.

export function washDelta(r, cx, cy, topZ, plat, s = 1) {
	const La = 0.42 * s;
	const Lb = 0.86 * s;
	const rootR = 0.3 * s;
	const platR = 0.11 * s;
	const arms = [0, 1, 2].map((i) => {
		const phi = (i / 3) * Math.PI * 2 + Math.PI / 6;
		const radial = [Math.cos(phi), Math.sin(phi)];
		const root = [cx + radial[0] * rootR, cy + radial[1] * rootR, topZ - 0.24 * s];
		const pj = [plat[0] + radial[0] * platR, plat[1] + radial[1] * platR, plat[2] + 0.06 * s];
		let lo = -0.9;
		let hi = 1.5;
		const elbowAt = (g) => [root[0] + radial[0] * La * Math.cos(g), root[1] + radial[1] * La * Math.cos(g), root[2] - La * Math.sin(g)];
		for (let it = 0; it < 22; it++) {
			const mid = (lo + hi) / 2;
			const e = elbowAt(mid);
			if (Math.hypot(e[0] - pj[0], e[1] - pj[1], e[2] - pj[2]) > Lb) lo = mid;
			else hi = mid;
		}
		return { root, elbow: elbowAt((lo + hi) / 2), pj, tangent: [-radial[1], radial[0]] };
	});
	arms.sort((a, b) => depthOf(...a.elbow) - depthOf(...b.elbow));
	const hex = (x, y, rad) => Array.from({ length: 6 }, (_, i) => [x + Math.cos((i / 6) * Math.PI * 2) * rad, y + Math.sin((i / 6) * Math.PI * 2) * rad]);
	r.prism(hex(cx, cy, 0.38 * s), topZ - 0.3 * s, 0.3 * s, SS.body);
	r.prism(hex(cx, cy, 0.4 * s), topZ - 0.32 * s, 0.03 * s, SS.accent);
	// Fourth axis: a telescoping shaft (two tubes) from the housing to the platform.
	r.line([cx, cy, topZ - 0.32 * s], [plat[0], plat[1], plat[2] + 0.06 * s], "#8f99a4", 1.3);
	r.line([cx, cy, topZ - 0.32 * s], [lerp(cx, plat[0], 0.45), lerp(cy, plat[1], 0.45), lerp(topZ - 0.32 * s, plat[2], 0.45)], "#5b6570", 2);
	for (const a of arms) {
		r.cylinder(a.root[0], a.root[1], a.root[2] - 0.05 * s, 0.07 * s, 0.1 * s, SS.accent, 8);
		r.beam(a.root, a.elbow, 0.08 * s, 0.09 * s, SS.body);
		for (const sg of [-1, 1]) {
			const o = 0.045 * s * sg;
			r.line([a.elbow[0] + a.tangent[0] * o, a.elbow[1] + a.tangent[1] * o, a.elbow[2]], [a.pj[0] + a.tangent[0] * o, a.pj[1] + a.tangent[1] * o, a.pj[2]], SS.rod, 2.2 * s);
		}
	}
	r.prism(hex(plat[0], plat[1], 0.14 * s), plat[2], 0.06 * s, SS.bright);
}

// ---------------------------------------------------------------------------
// Soft finger tool: a palm with two facing rows of silicone fingers along the item's long axis.
// The fingers close across the item and cradle it under its widest part.

/**
 * Tool centred over (x, y): zItem is the base height of the held item, ang its long-axis angle,
 * open 0 (closed, cradling) .. 1 (open). platZ: platform underside (the flange runs up to it).
 * held(): draws the held item between the rows (painter's order), or null.
 */
export function fingerTool(r, x, y, zItem, ang, open, platZ, held = null) {
	const ca = Math.cos(ang);
	const sa = Math.sin(ang);
	const at = (f, sd, z) => [x + f * ca - sd * sa, y + f * sa + sd * ca, z];
	const palmZ = zItem + 0.13;
	r.cylinder(x, y, palmZ + 0.03, 0.045, Math.max(0.01, platZ - palmZ - 0.03), SS.joint, 8);
	const row = (sd) =>
		[-0.08, 0, 0.08].map((f) => ({
			root: at(f, sd * 0.07, palmZ),
			mid: at(f, sd * (0.1 + open * 0.05), palmZ - 0.07),
			tip: at(f, sd * (0.055 + open * 0.08), zItem + 0.014 + open * 0.035),
		}));
	const rows = [row(-1), row(1)];
	rows.sort((a, b) => depthOf(...a[1].mid) - depthOf(...b[1].mid));
	const finger = (fi) => {
		r.tube(fi.root, fi.mid, 0.019, SS.silicone, 6);
		r.tube(fi.mid, fi.tip, 0.016, SS.silicone, 6);
	};
	const sortRow = (rw) => [...rw].sort((a, b) => depthOf(...a.mid) - depthOf(...b.mid));
	for (const fi of sortRow(rows[0])) finger(fi);
	if (held) held();
	r.orientedBox(x, y, palmZ, 0.25, 0.16, 0.035, ang, SS.bright);
	for (const fi of sortRow(rows[1])) finger(fi);
}

/** Food-grade suction cup (cone) whose lip is at z, with its stem. */
export function suctionCup(r, x, y, z, s = 1) {
	r.cylinder(x, y, z + 0.035 * s, 0.018 * s, 0.04 * s, SS.joint, 6);
	r.cone(x, y, z, 0.048 * s, 0.038 * s, SS.cup, 8);
}

// ---------------------------------------------------------------------------
// Sensors and lamps

/** A small indicator lamp. */
export function lamp(r, x, y, z, color) {
	r.sphere(x, y, z, 0.028, color, 0);
}

/** A compact sensor head (dark box) at (x, y, z), w x d x h. */
export function sensorBox(r, x, y, z, w = 0.08, d = 0.08, h = 0.07) {
	r.box(x - w / 2, y - d / 2, z, w, d, h, SS.sensor);
}

// ---------------------------------------------------------------------------
// Roller conveyor section along x (from x0 to x1) centred on y, half-width hw, top at z.

export function rollerConveyor(r, x0, x1, y, hw, z, opts = {}) {
	const legs = [];
	for (let x = x0 + 0.15; x < x1 - 0.1; x += 1.0) legs.push(x);
	legs.push(x1 - 0.12);
	for (const lx of legs) r.box(lx, y - hw + 0.04, 0, 0.08, 0.08, z - 0.1, SS.dark);
	r.box(x0, y - hw, z - 0.1, x1 - x0, 0.06, 0.08, SS.steel);
	r.ground(x0, y - hw + 0.06, x1 - x0, 2 * hw - 0.12, "#7f8994", z - 0.06);
	for (let x = x0 + 0.08; x < x1 - 0.04; x += opts.pitch ?? 0.16) r.line([x, y - hw + 0.07, z - 0.025], [x, y + hw - 0.07, z - 0.025], "#c2c9d0", 2.2);
	for (const lx of legs) r.box(lx, y + hw - 0.12, 0, 0.08, 0.08, z - 0.1, SS.dark);
	r.box(x0, y + hw - 0.06, z - 0.1, x1 - x0, 0.06, 0.08, SS.steel);
}
