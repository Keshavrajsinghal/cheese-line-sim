// The open-top rack cart: 24 lidded plates in a 4 x 6 grid on a stainless deck, low rails round
// the top, a lower shelf, castor wheels, and a push bar at one end. Drawn in two parts so the
// gantry and people can sort between them: "back" (wheels, shelf, deck, far rails, plates) and
// "front" (near rails, near posts, push bar). Drawing code only; no text.

import { PAL } from "./common.js";
import { drawPlate, FOOD, frame, FULL } from "./food.js";

/** Half sizes along the push-bar axis (a) and across it (c); deck and rail heights; the bar. */
export const CART = { a: 1.48, c: 1.38, deck: 0.85, rim: 1.02, bar: 1.6, barZ: 1.05, barW: 1.0 };
const PITCH = { a: 0.48, c: 0.67 };

/** Cart-local (a, c) of grid cell i (0..23): rows of 6 along a, 4 rows across, filled back to front. */
export function cellLocal(i) {
	return [((i % 6) - 2.5) * PITCH.a, (Math.floor(i / 6) - 1.5) * PITCH.c];
}

/** A finished plate in a cart; at low zoom a cheaper version (tray, food colors, lid). */
function storedPlate(r, x, y, z, h) {
	if (r.zoom >= 0.8) {
		drawPlate(r, x, y, z, h, FULL, { noBadge: true });
		return;
	}
	const at = frame(x, y, z, h, 1);
	r.orientedBox(x, y, z, 0.64, 0.46, 0.05, h, FOOD.tray);
	const patch = (f0, f1, s0, s1, color) => r.quad([at(f0, s0, 0.08), at(f1, s0, 0.08), at(f1, s1, 0.08), at(f0, s1, 0.08)], color, { flat: true });
	patch(-0.28, -0.1, -0.1, 0.1, FOOD.grape);
	patch(-0.09, -0.02, -0.14, 0.12, FOOD.apple);
	patch(0.0, 0.12, -0.08, 0.1, FOOD.pack);
	patch(0.13, 0.28, -0.16, 0.16, FOOD.cheese[0]);
	r.orientedBox(x, y, z + 0.05, 0.66, 0.48, 0.15, h, FOOD.lid, { alpha: 0.4, edge: "rgba(255,255,255,0.85)" });
}

/**
 * Draw one part ("back" or "front") of a rack cart centered at (cx, cy) whose push bar points along
 * angle ha, holding `count` plates (cells 0..count-1).
 */
export function drawCart(r, cx, cy, ha, count, part) {
	const ca = Math.cos(ha);
	const sa = Math.sin(ha);
	const P = (a, c, z) => [cx + a * ca - c * sa, cy + a * sa + c * ca, z];
	const front = (a, c) => a * ca - c * sa + a * sa + c * ca > 0.01; // nearer the viewer than the center
	const { a: A, c: C, deck, rim } = CART;
	const rail = (a0, c0, a1, c1) => {
		for (const z of [deck + 0.09, rim]) r.beam(P(a0, c0, z), P(a1, c1, z), 0.03, 0.03, PAL.steel);
	};
	const sides = [
		[-A, -C, -A, C],
		[A, -C, A, C],
		[-A, -C, A, -C],
		[-A, C, A, C],
	];
	const posts = [
		[-A + 0.03, -C + 0.03],
		[A - 0.03, -C + 0.03],
		[-A + 0.03, C - 0.03],
		[A - 0.03, C - 0.03],
	];
	const post = ([a, c]) => {
		const p = P(a, c, 0.2);
		r.orientedBox(p[0], p[1], 0.2, 0.06, 0.06, rim - 0.2, ha, PAL.steel);
	};
	const bar = () => {
		const { bar: B, barZ, barW } = CART;
		for (const c of [-barW, barW]) r.tube(P(A, c, rim), P(B, c, barZ), 0.022, PAL.steelDark, 6);
		r.tube(P(B, -barW, barZ), P(B, barW, barZ), 0.025, PAL.steelDark, 6);
		r.tube(P(B, -0.45, barZ), P(B, 0.45, barZ), 0.034, "#2f6fb3", 7);
	};
	const barFront = front(1, 0);
	if (part === "back") {
		for (const [a, c] of posts) {
			const w = P(a * 0.88, c * 0.86, 0.07);
			r.box(w[0] - 0.04, w[1] - 0.04, 0.1, 0.08, 0.08, 0.1, PAL.steelDark);
			r.tube(P(a * 0.88, c * 0.86 - 0.03, 0.07), P(a * 0.88, c * 0.86 + 0.03, 0.07), 0.07, PAL.dark, 8);
		}
		r.orientedBox(cx, cy, 0.18, 2 * A - 0.08, 2 * C - 0.08, 0.04, ha, "#aeb6c0");
		if (!barFront) bar();
		for (const p of posts) if (!front(...p)) post(p);
		r.orientedBox(cx, cy, deck - 0.05, 2 * A, 2 * C, 0.05, ha, PAL.steel, { top: "#cfd6dd" });
		for (let k = 0; k <= 6; k++) r.line(P((k - 3) * PITCH.a, -C + 0.05, deck + 0.003), P((k - 3) * PITCH.a, C - 0.05, deck + 0.003), "#9aa3ad", 1.2);
		for (let k = 0; k <= 4; k++) r.line(P(-A + 0.05, (k - 2) * PITCH.c, deck + 0.003), P(A - 0.05, (k - 2) * PITCH.c, deck + 0.003), "#9aa3ad", 1.2);
		for (const s of sides) if (!front((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) rail(...s);
		const cells = [];
		for (let i = 0; i < count; i++) {
			const [a, c] = cellLocal(i);
			const p = P(a, c, deck);
			cells.push(p);
		}
		cells.sort((p, q) => p[0] + p[1] - q[0] - q[1]);
		for (const p of cells) storedPlate(r, p[0], p[1], deck, ha + Math.PI / 2);
		return;
	}
	for (const s of sides) if (front((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)) rail(...s);
	for (const p of posts) if (front(...p)) post(p);
	if (barFront) bar();
}
