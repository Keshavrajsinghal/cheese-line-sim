// Shared drawing helpers and palette for the plant. Drawing code only; no text.

import { LAYER } from "../engine/scene.js";

export const PAL = {
	bg: "#8fb3c9", // outside the building
	floor: "#d3d8dc", // cold room floor (food-grade resin)
	floor2: "#ccd1d6",
	aisle: "#dfe3e6",
	aisleLine: "#f2c230",
	warmFloor: "#d8cfc2",
	wall: "#eef1f3",
	wallBand: "#5c8fb0", // cold room band
	warmWall: "#efe6d8",
	warmBand: "#c08a4e",
	steel: "#b8c0c8", // stainless
	steelDark: "#8e98a4",
	dark: "#3b4048",
	belt: "#3a3f47",
	beltBlue: "#2f6fb3", // food-grade blue modular belt
	guardPost: "#f2c230",
	guardPanel: "#cde7f4",
	safety: "#f2c230",
	danger: "#d9583b",
	ok: "#2e9e5b",
	screen: "#1f2a36",
	screenOn: "#5fd38d",
	rack: "#9aa3ad",
	wood: "#b07a4a",
	cardboard: "#c9a46a",
	pocketTray: "#4a90c2", // reusable grape pocket trays (blue, food-grade)
	cheeseTray: ["#e8c547", "#d9824a", "#8fbf5a", "#c9a0dc"], // colour-coded lanes, one per cheese
	track: "#d9583b",
	person: { op1: "#2f80c9", op2: "#2e9e5b", tech: "#e8792f", skin: "#f0c8a0", hair: "#5a4632", boots: "#2b2f36", coat: "#f4f6f8" },
};

/** One depth-sorted static object covering [x0,x1] x [y0,y1], h tall. */
export function object(scene, x0, y0, x1, y1, h, draw, opts = {}) {
	scene.add({ bounds: [x0, y0, 0, x1, y1, h], draw, group: opts.group, depth: opts.depth, live: opts.live, layer: LAYER.OBJECT });
}

/** A flat floor decal (drawn under objects). */
export function floorRect(scene, x0, y0, x1, y1, color, opts = {}) {
	scene.add({ layer: LAYER.GROUND, depth: opts.depth ?? 0, bounds: [x0, y0, 0, x1, y1, 0.03], group: opts.group, draw: (r) => r.ground(x0, y0, x1 - x0, y1 - y0, color, opts.z ?? 0.02) });
}

export const ease = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * A guard fence run from (x0,y0) to (x1,y1) (axis-aligned): yellow posts, clear panels.
 * opts.gaps: [[a, b], ...] spans along the run (distance from the start) left open, such as feeder
 * loading openings and reject lanes. Panels are cut exactly at each gap, with a post at each edge.
 */
export function guardRun(r, x0, y0, x1, y1, h = 1.85, opts = {}) {
	const alongY = x0 === x1;
	const len = alongY ? y1 - y0 : x1 - x0;
	const at = (s, z) => (alongY ? [x0, y0 + s, z] : [x0 + s, y0, z]);
	const gaps = (opts.gaps ?? []).map(([a, b]) => [Math.max(0, a), Math.min(len, b)]).filter(([a, b]) => b > a);
	const inGap = (s) => gaps.some(([a, b]) => s > a + 0.01 && s < b - 0.01);
	const step = 1.2;
	const posts = new Set();
	for (let s = 0; s <= len + 1e-6; s += step) posts.add(+Math.min(s, len).toFixed(3));
	posts.add(+len.toFixed(3));
	for (const [a, b] of gaps) {
		if (a > 0.05) posts.add(+a.toFixed(3));
		if (b < len - 0.05) posts.add(+b.toFixed(3));
	}
	const sorted = [...posts].filter((s) => !inGap(s)).sort((a, b) => a - b);
	const lo = opts.low ?? 0.15;
	for (let k = 0; k < sorted.length - 1; k++) {
		const a = sorted[k];
		const b = sorted[k + 1];
		if (b - a < 0.05 || inGap((a + b) / 2)) continue;
		r.quad([at(a + 0.04, lo), at(b - 0.04, lo), at(b - 0.04, h - 0.08), at(a + 0.04, h - 0.08)], PAL.guardPanel, { alpha: 0.38, edge: "rgba(120,150,170,0.6)" });
	}
	for (const s of sorted) {
		const [px, py] = at(s, 0);
		r.box(px - 0.05, py - 0.05, 0, 0.1, 0.1, h, PAL.guardPost);
	}
	// Top rail, broken at the gaps.
	let s0 = 0;
	for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
		if (a > s0) r.line(at(s0, h), at(a, h), "#c9a220", 2);
		s0 = b;
	}
	if (s0 < len) r.line(at(s0, h), at(len, h), "#c9a220", 2);
}
