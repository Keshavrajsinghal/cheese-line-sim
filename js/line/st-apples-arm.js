// Apple station robot: a hygienic six-axis arm (white washdown covers, stainless pedestal) with a
// food-grade oval bellows suction cup on a straight tool. The cup can point in any direction, so the
// wrist can turn a slice from lying flat on the pick belt to standing and leaning in the tray.
// Proportions follow js/engine/robots.js drawSixAxis, enlarged to reach from behind the pick belt
// to the far side of the tray. Drawing code only.

import { ik2 } from "../engine/robots.js";
import { PAL } from "./common.js";

/** Link lengths and heights (drawing meters). The plinth top is the arm's base height. */
export const ARM = { L1: 1.3, L2: 1.45, shoulder: 0.8, tool: 0.28, plinth: 0.25 };

const C = { body: "#f4f6f7", accent: "#5c8fb0", joint: "#cfd6dc", metal: PAL.steel, cup: "#2f78c4", cupLip: "#24609e" };

const add = (p, d, k = 1) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
	const l = Math.hypot(v[0], v[1], v[2]) || 1;
	return [v[0] / l, v[1] / l, v[2] / l];
};

/** Stainless washdown pedestal under an arm (static). */
export function drawPlinth(r, bx, by) {
	const h = ARM.plinth;
	r.box(bx - 0.36, by - 0.36, 0, 0.72, 0.72, 0.04, PAL.steelDark);
	r.box(bx - 0.31, by - 0.31, 0.04, 0.62, 0.62, h - 0.04, PAL.steel, { top: "#cfd6dc" });
}

/**
 * The arm on its plinth at (bx, by). The cup's lip touches `cup`; d is the unit tool direction
 * (from the wrist toward the cup) and axis the long axis of the oval lip (perpendicular to d).
 * held(r) draws the held item at the right point in the painter's order (before the forearm and
 * the tool, which sit above or in front of it).
 */
export function drawCupArm(r, bx, by, cup, d, axis, held) {
	const { L1, L2 } = ARM;
	const bz = ARM.plinth;
	const S = [bx, by, bz + ARM.shoulder];
	const W = add(cup, d, -ARM.tool);
	const yaw = Math.atan2(W[1] - S[1], W[0] - S[0]);
	const f = [Math.cos(yaw), Math.sin(yaw)];
	const side = [-f[1], f[0], 0];
	const k = ik2(L1, L2, Math.hypot(W[0] - S[0], W[1] - S[1]), W[2] - S[2], true);
	const E = [S[0] + f[0] * k.elbow[0], S[1] + f[1] * k.elbow[0], S[2] + k.elbow[1]];
	const Wp = [S[0] + f[0] * k.wrist[0], S[1] + f[1] * k.wrist[0], S[2] + k.wrist[1]];
	const off = (p, dd) => add(p, side, dd);

	// Base, turret, shoulder.
	r.cylinder(bx, by, bz, 0.27, 0.12, C.joint, 12);
	r.cylinder(bx, by, bz + 0.12, 0.23, 0.32, C.body, 12);
	r.orientedBox(bx, by, bz + 0.42, 0.5, 0.42, 0.42, yaw, C.body);
	r.tube(off(S, -0.25), off(S, 0.25), 0.16, C.accent, 12);
	// Upper arm and elbow.
	r.beam(off(S, 0.08), off(E, 0.08), 0.22, 0.26, C.body);
	r.tube(off(E, -0.16), off(E, 0.21), 0.12, C.accent, 10);
	held?.(r);
	// Forearm, wrist, tool.
	r.beam(E, Wp, 0.16, 0.18, C.body);
	r.tube(off(Wp, -0.09), off(Wp, 0.09), 0.075, C.accent, 10);
	const bellowsTop = add(cup, d, -0.1);
	r.tube(Wp, bellowsTop, 0.034, C.metal, 8);
	drawOvalCup(r, cup, d, axis);
}

/** Food-grade oval bellows cup whose lip touches p, pointing along d. */
export function drawOvalCup(r, p, d, axis) {
	const a = unit(add(axis, d, -(axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2])));
	const b = cross(d, a);
	// Bellows folds, from the tool down to the lip.
	const folds = [0.04, 0.03, 0.04, 0.03];
	folds.forEach((rad, i) => {
		const p0 = add(p, d, -0.1 + i * 0.022);
		r.tube(p0, add(p0, d, 0.022), rad, C.cup, 8);
	});
	// The oval lip lies on the slice's cut face.
	const lip = add(p, d, -0.006);
	const pts = [];
	for (let i = 0; i < 12; i++) {
		const t = (i / 12) * Math.PI * 2;
		pts.push(add(add(lip, a, Math.cos(t) * 0.052), b, Math.sin(t) * 0.036));
	}
	r.quad(pts, C.cupLip, { edge: "rgba(20,60,110,0.6)" });
}
