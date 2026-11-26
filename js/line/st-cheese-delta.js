// Cheese station robot: a 4-axis delta (three parallel arms plus a rotating, telescoping center
// shaft) hanging from the station frame, with vacuum cups of fatty-food-approved silicone. Robot B's
// tool head carries two cups: the firm-cheese cup and a softer, white brie cup run at lower vacuum;
// the cup in use is extended below the other. Geometry follows js/engine/robots.js drawDelta,
// sized to reach two supply trays and the plate. Drawing code only.

import { shade } from "../engine/iso.js";
import { PAL } from "./common.js";

export const DELTA = { s: 1.7, topZ: 2.55, cupOff: 0.1, head: 0.16, cupLen: 0.05, cupExt: 0.04 };
const S = DELTA.s;
const LA = 0.42 * S;
const LB = 0.86 * S;
const ROOT_R = 0.3 * S;
const PLAT_R = 0.11 * S;
const C = { body: "#eef1f3", arm: "#9fb0bf", joint: "#55616d", rod: "#c4ccd4", firm: "#2f78c4", brie: "#f7f6ef" };

/** Lip drop below the platform for a cup extended by e (0 retracted .. 1 in use). */
export const cupDrop = (e) => DELTA.head + DELTA.cupLen + DELTA.cupExt * e;

/** The tool's cups, as offsets along the tool angle: single (robot A) or firm + brie (robot B). */
export const CUPS = {
	single: [{ off: 0, color: C.firm, r: 0.045, folds: 1 }],
	pair: [
		{ off: DELTA.cupOff, color: C.firm, r: 0.045, folds: 1 },
		{ off: -DELTA.cupOff, color: C.brie, r: 0.06, folds: 2 },
	],
};

/**
 * Delta hanging from a housing at (cx, cy), housing top at DELTA.topZ, platform center at plat.
 * theta: tool angle; cups: CUPS.single or CUPS.pair; ext: extension per cup (0..1).
 * opts.mount(r): the beam the housing hangs from (drawn over the housing's top);
 * opts.held(r): the held wedge under the cup in use (drawn before the tool covers it).
 */
export function drawCheeseDelta(r, cx, cy, plat, theta, cups, ext, opts = {}) {
	const topZ = DELTA.topZ;
	const arms = [0, 1, 2].map((i) => {
		const phi = (i / 3) * Math.PI * 2 + Math.PI / 6;
		const radial = [Math.cos(phi), Math.sin(phi)];
		const root = [cx + radial[0] * ROOT_R, cy + radial[1] * ROOT_R, topZ - 0.24 * S];
		const pj = [plat[0] + radial[0] * PLAT_R, plat[1] + radial[1] * PLAT_R, plat[2] + 0.06 * S];
		// Upper-arm angle whose elbow sits one rod length from the platform joint.
		const elbowAt = (g) => [root[0] + radial[0] * LA * Math.cos(g), root[1] + radial[1] * LA * Math.cos(g), root[2] - LA * Math.sin(g)];
		let lo = -1.2;
		let hi = 1.55;
		for (let it = 0; it < 24; it++) {
			const mid = (lo + hi) / 2;
			const e = elbowAt(mid);
			if (Math.hypot(e[0] - pj[0], e[1] - pj[1], e[2] - pj[2]) > LB) lo = mid;
			else hi = mid;
		}
		return { root, elbow: elbowAt((lo + hi) / 2), pj, tangent: [-radial[1], radial[0]] };
	});
	arms.sort((a, b) => a.elbow[0] + a.elbow[1] - (b.elbow[0] + b.elbow[1]));
	// Housing (white washdown cover) with its stainless mounting plate.
	const hex = (rad, x = cx, y = cy) => Array.from({ length: 6 }, (_, i) => [x + Math.cos((i / 6) * Math.PI * 2) * rad, y + Math.sin((i / 6) * Math.PI * 2) * rad]);
	r.prism(hex(0.38 * S), topZ - 0.3 * S, 0.24 * S, C.body);
	r.prism(hex(0.3 * S), topZ - 0.06 * S, 0.06 * S, PAL.steel);
	opts.mount?.(r);
	// Fourth axis: telescoping shaft from the housing to the platform.
	r.line([cx, cy, topZ - 0.3 * S], [plat[0], plat[1], plat[2] + 0.06 * S], "#7f8b98", 2.6 * S);
	for (const a of arms) {
		r.beam(a.root, a.elbow, 0.08 * S, 0.09 * S, C.arm);
		r.sphere(a.elbow[0], a.elbow[1], a.elbow[2], 0.05 * S, C.joint, 0);
		for (const sg of [-1, 1]) {
			const o = 0.045 * S * sg;
			r.line([a.elbow[0] + a.tangent[0] * o, a.elbow[1] + a.tangent[1] * o, a.elbow[2]], [a.pj[0] + a.tangent[0] * o, a.pj[1] + a.tangent[1] * o, a.pj[2]], C.rod, 2.2 * S);
		}
	}
	opts.held?.(r);
	// Tool: rotary flange, head bar (robot B), cups. Far cup first.
	const ca = Math.cos(theta);
	const sa = Math.sin(theta);
	const hz = plat[2] - DELTA.head;
	r.cylinder(plat[0], plat[1], hz + 0.04, 0.035, DELTA.head - 0.04, C.joint, 8);
	if (cups.length > 1) r.orientedBox(plat[0], plat[1], hz, 2 * DELTA.cupOff + 0.09, 0.07, 0.045, theta, PAL.steel);
	const order = cups.map((c, i) => ({ c, i, d: c.off * (ca + sa) })).sort((a, b) => a.d - b.d);
	for (const { c, i } of order) {
		const x = plat[0] + ca * c.off;
		const y = plat[1] + sa * c.off;
		const lip = plat[2] - cupDrop(ext[i]);
		r.cylinder(x, y, lip + 0.03, 0.018, hz - lip - 0.03, PAL.steelDark, 6);
		for (let f = c.folds; f >= 1; f--) r.cylinder(x, y, lip + 0.012 + f * 0.016, c.r * 0.72, 0.016, shade(c.color, 0.92), 8);
		r.cylinder(x, y, lip, c.r, 0.016, c.color, 10);
	}
	// Platform last: it sits above the tool.
	r.prism(hex(0.14 * S, plat[0], plat[1]), plat[2], 0.06 * S, shade(C.body, 0.95));
}
