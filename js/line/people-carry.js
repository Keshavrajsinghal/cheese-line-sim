// What the operators carry: Operator 1's stock (grape pocket trays, apple tubs, cracker crates,
// single-cheese trays, lid and tray stacks, empties going back to the wash) and Operator 2's fixed
// plate. Each item is drawn in its own frame F(u, v, w): u away from the carrier's chest, v across
// their body, w up, origin at the item's bottom center. Drawing code only; no text.

import { VIEW } from "../engine/iso.js";
import { PAL } from "./common.js";
import { drawPlate, FOOD, PLATE_AFTER } from "./food.js";

/** Item sizes in meters: l along u (depth from the chest), w across the body, h tall. */
export const SIZE = {
	pocket: { l: 0.36, w: 0.52, h: 0.24 },
	apples: { l: 0.38, w: 0.5, h: 0.26 },
	packs: { l: 0.38, w: 0.52, h: 0.2 },
	cheese: { l: 0.34, w: 0.46, h: 0.25 },
	lids: { l: 0.38, w: 0.52, h: 0.3 },
	trays: { l: 0.36, w: 0.5, h: 0.32 },
	empties: { l: 0.36, w: 0.5, h: 0.2 },
	plate: { l: 0.42, w: 0.58, h: 0.12 },
};

const TUB = "#e8ebe4"; // translucent white tub, the slices showing through
const TUB_LID = "#cdd9e1";
const CRATE = "#7f95aa"; // food-grade plastic crate (no cardboard in the cold room)
const POCKET_EMPTY = "#3a77a6";

/** An axis box in item space, [u0,u1] x [v0,v1] x [w0,w1]. opts.top colors the top face. */
function lbox(r, F, u0, u1, v0, v1, w0, w1, color, opts = {}) {
	const c = (u, v, w) => F(u, v, w);
	const faces = [
		[c(u0, v0, w0), c(u1, v0, w0), c(u1, v1, w0), c(u0, v1, w0)],
		[c(u0, v0, w1), c(u1, v0, w1), c(u1, v1, w1), c(u0, v1, w1)],
		[c(u0, v0, w0), c(u0, v1, w0), c(u0, v1, w1), c(u0, v0, w1)],
		[c(u1, v0, w0), c(u1, v1, w0), c(u1, v1, w1), c(u1, v0, w1)],
		[c(u0, v0, w0), c(u1, v0, w0), c(u1, v0, w1), c(u0, v0, w1)],
		[c(u0, v1, w0), c(u1, v1, w0), c(u1, v1, w1), c(u0, v1, w1)],
	];
	const colors = opts.top ? [color, opts.top, color, color, color, color] : undefined;
	r.mesh(faces, color, { ...opts, colors, center: c((u0 + u1) / 2, (v0 + v1) / 2, (w0 + w1) / 2) });
}

/** Rim lines around an opaque stack, only on the two sides that face the viewer. */
function rims(r, F, l, w, heights, color, width) {
	const o = F(0, 0, 0);
	const nu = F(1, 0, 0);
	const nv = F(0, 1, 0);
	const toward = (p, sgn) => sgn * ((p[0] - o[0]) * VIEW[0] + (p[1] - o[1]) * VIEW[1] + (p[2] - o[2]) * VIEW[2]) > 0;
	const su = toward(nu, 1) ? l / 2 : -l / 2;
	const sv = toward(nv, 1) ? w / 2 : -w / 2;
	for (const h of heights) r.polyline([F(-su, sv, h), F(su, sv, h), F(su, -sv, h)], color, width);
}

function trayStack(r, F, s, n, color, topColor) {
	const th = s.h / n;
	for (let i = 0; i < n; i++) lbox(r, F, -s.l / 2, s.l / 2, -s.w / 2, s.w / 2, i * th, (i + 1) * th - 0.008, color, { top: i === n - 1 ? topColor : undefined });
}

function grapesOnTop(r, F, s) {
	const z = s.h;
	for (const u of [-0.08, 0.08])
		for (const v of [-0.17, 0, 0.17]) {
			r.sphere(...F(u, v, z + 0.03), 0.042, FOOD.grape, 0);
			r.sphere(...F(u + 0.03, v + 0.03, z + 0.05), 0.036, FOOD.grape2, 0);
		}
}

function cheeseOnTop(r, F, s, lane) {
	const z = s.h + 0.003;
	const col = FOOD.cheese[lane] ?? FOOD.cheese[0];
	for (const [u, v, a] of [
		[-0.06, -0.13, 0.4],
		[0.06, 0.0, 2.6],
		[-0.05, 0.13, -0.7],
	]) {
		const pts = [0, 2.3, -2.3].map((d, i) => {
			const len = i === 0 ? 0.09 : 0.07;
			return F(u + Math.cos(a + d) * len, v + Math.sin(a + d) * len, z);
		});
		r.quad(pts, col, { flat: true });
	}
}

/**
 * Draw a carried item in frame F. kind: pocket, apples, packs, cheese, lids, trays, empties.
 * opts: { lane (0-3, cheese trays and cheese empties), from ("pocket" or "cheese", for empties),
 * open (the apple tub's lid is off) }.
 */
export function drawCarry(r, F, kind, opts = {}) {
	const s = SIZE[kind] ?? SIZE.trays;
	const lane = opts.lane ?? 0;
	if (kind === "pocket") {
		trayStack(r, F, s, 4, PAL.pocketTray, "#3d7fb0");
		grapesOnTop(r, F, s);
	} else if (kind === "apples") {
		lbox(r, F, -s.l / 2, s.l / 2, -s.w / 2, s.w / 2, 0, s.h, TUB, { top: "#f3e6b8" });
		if (!opts.open) lbox(r, F, -s.l / 2 - 0.015, s.l / 2 + 0.015, -s.w / 2 - 0.015, s.w / 2 + 0.015, s.h, s.h + 0.035, TUB_LID);
		else for (const u of [-0.1, 0, 0.1]) r.line(F(u, -0.18, s.h + 0.004), F(u + 0.03, 0.18, s.h + 0.004), FOOD.skin, 1.2);
	} else if (kind === "packs") {
		lbox(r, F, -s.l / 2, s.l / 2, -s.w / 2, s.w / 2, 0, s.h, CRATE, { top: FOOD.pack });
		for (const u of [-0.12, -0.04, 0.04, 0.12]) r.line(F(u, -0.2, s.h + 0.003), F(u, 0.2, s.h + 0.003), FOOD.packBand, 1.3);
		rims(r, F, s.l, s.w, [0.06], "rgba(40,55,70,0.45)", 1);
	} else if (kind === "cheese") {
		const col = PAL.cheeseTray[lane] ?? PAL.cheeseTray[0];
		trayStack(r, F, s, 5, col, col);
		cheeseOnTop(r, F, s, lane);
	} else if (kind === "lids") {
		lbox(r, F, -s.l / 2, s.l / 2, -s.w / 2, s.w / 2, 0, s.h, FOOD.lid, { alpha: 0.5, edge: "rgba(255,255,255,0.9)" });
		for (const h of [0.06, 0.12, 0.18, 0.24]) r.polyline([F(-s.l / 2, -s.w / 2, h), F(s.l / 2, -s.w / 2, h), F(s.l / 2, s.w / 2, h), F(-s.l / 2, s.w / 2, h)], "rgba(255,255,255,0.85)", 0.9, true);
	} else if (kind === "trays") {
		lbox(r, F, -s.l / 2, s.l / 2, -s.w / 2, s.w / 2, 0, s.h, FOOD.tray, { top: FOOD.trayIn });
		rims(r, F, s.l, s.w, [0.05, 0.1, 0.15, 0.2, 0.25], "#a88d60", 0.9);
	} else if (kind === "empties") {
		if (opts.from === "cheese") {
			const col = PAL.cheeseTray[lane] ?? PAL.cheeseTray[0];
			trayStack(r, F, s, 4, col, col);
		} else trayStack(r, F, s, 4, PAL.pocketTray, POCKET_EMPTY);
	}
}

/** A fixed plate on its way back to the line: from Rework Table 1 (no lid yet) or Table 2 (lidded). */
export function drawCarriedPlate(r, x, y, z, heading, table) {
	drawPlate(r, x, y, z, heading, table === "rework-2" ? PLATE_AFTER.outfeed : PLATE_AFTER.buffer, { scale: 0.9, lineScale: 0.8 });
}
