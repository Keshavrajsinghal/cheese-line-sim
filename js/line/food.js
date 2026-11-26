// The cheese plate as low-poly models, laid out as the design describes: a molded fiber tray,
// the grape bunch lying flat at the left end, 4 apple slices standing upright in a row (slices
// 3-4 leaning on 1-2), one cracker pack lying diagonally in the center, and 4 different cheese
// wedges in two layers (two firm wedges on the bottom; a firm wedge and the brie on top, partly on
// the pack), under a clear snap-on lid with a printed code. Sizes are exaggerated (about 2.5x).
// Drawing code only; no text.

import { depthOf } from "../engine/iso.js";

export const FOOD = {
	tray: "#c9ae80",
	trayIn: "#b89b6c",
	grape: "#6f3f8f",
	grape2: "#83509f",
	stem: "#5d7b34",
	apple: "#f6ecc8",
	skin: "#c8352b",
	pack: "#e3e7eb",
	packBand: "#c0392b",
	// Four different cheeses: three firm, plus the brie.
	cheese: ["#f2b33d", "#f4dd8a", "#e98f3a", "#f7f1de"],
	rind: ["#d9952a", "#d9c06a", "#c7702a", "#fdfcf6"],
	lid: "#e9f5fb",
	label: "#ffffff",
	pass: "#2e9e5b",
	fail: "#d9583b",
};

/** Which items are on the plate after each stop of the tray ride. */
export const PLATE_AFTER = {
	denester: {},
	grapes: { grapes: true },
	"apples-a": { grapes: true, apples: 2 },
	"apples-b": { grapes: true, apples: 4 },
	crackers: { grapes: true, apples: 4, crackers: true },
	"cheese-a": { grapes: true, apples: 4, crackers: true, cheese: 2 },
	"cheese-b": { grapes: true, apples: 4, crackers: true, cheese: 4 },
	buffer: { grapes: true, apples: 4, crackers: true, cheese: 4 },
	"inspect-1": { grapes: true, apples: 4, crackers: true, cheese: 4, pass: 1 },
	lidding: { grapes: true, apples: 4, crackers: true, cheese: 4, lid: true, code: true },
	"inspect-2": { grapes: true, apples: 4, crackers: true, cheese: 4, lid: true, code: true, pass: 2 },
	outfeed: { grapes: true, apples: 4, crackers: true, cheese: 4, lid: true, code: true },
};
export const FULL = PLATE_AFTER.outfeed;

/** Tray-local frame: f along the tray's long axis (heading), sd across it, zz up; scaled by s. */
export function frame(cx, cy, z, heading, s) {
	const ca = Math.cos(heading);
	const sa = Math.sin(heading);
	return (f, sd, zz = 0) => [cx + (f * ca - sd * sa) * s, cy + (f * sa + sd * ca) * s, z + zz * s];
}

// ---------------------------------------------------------------------------
// Items, each drawable on its own (robots carry them)

/** A grape bunch lying flat, centered at (x, y, z), its stem pointing along angle rot. */
export function drawBunch(r, x, y, z, s = 1, rot = 0, lw = 1) {
	const ca = Math.cos(rot);
	const sa = Math.sin(rot);
	const at = (f, sd, zz) => [x + (f * ca - sd * sa) * s, y + (f * sa + sd * ca) * s, z + zz * s];
	const balls = [];
	const rows = [3, 4, 4, 3, 2, 1];
	rows.forEach((n, row) => {
		for (let i = 0; i < n; i++) balls.push([0.09 - row * 0.042, (i - (n - 1) / 2) * 0.046, (row + i) % 2 ? 0.045 : 0.03]);
	});
	balls.sort((a, b) => depthOf(...at(...a)) - depthOf(...at(...b)));
	r.line(at(0.1, 0, 0.05), at(0.17, 0.02, 0.07), FOOD.stem, 2.2 * s * lw);
	balls.forEach((b, i) => {
		const p = at(...b);
		r.sphere(p[0], p[1], p[2], 0.027 * s, i % 3 ? FOOD.grape : FOOD.grape2, 0);
	});
}

/**
 * An apple slice (a half-moon, skin on the curved edge) standing on its cut edge at (x, y, z).
 * along: the direction its flat face lies in (radians); tilt: lean from vertical toward the face
 * normal (radians). With tilt = PI/2 it lies flat.
 */
export function drawSlice(r, x, y, z, s = 1, along = 0, tilt = 0, lw = 1) {
	const R = 0.085 * s;
	const ux = Math.cos(along);
	const uy = Math.sin(along);
	const nx = -uy;
	const ny = ux;
	const st = Math.sin(tilt);
	const ct = Math.cos(tilt);
	const pts = [];
	for (let i = 0; i <= 8; i++) {
		const a = (i / 8) * Math.PI;
		const u = Math.cos(a) * R;
		const v = Math.sin(a) * R;
		pts.push([x + ux * u + nx * v * st, y + uy * u + ny * v * st, z + v * ct]);
	}
	r.quad(pts, FOOD.apple, { edge: "rgba(170,130,70,0.55)" });
	r.polyline(pts, FOOD.skin, 1.5 * s * lw);
}

export function drawPack(r, x, y, z, s = 1, rot = 0) {
	r.orientedBox(x, y, z, 0.17 * s, 0.11 * s, 0.03 * s, rot, FOOD.pack);
	r.orientedBox(x, y, z + 0.001, 0.045 * s, 0.112 * s, 0.032 * s, rot, FOOD.packBand);
}

/** A cheese wedge (triangular prism) at (x, y, z); kind 0-3 picks the cheese (3 is the brie). */
export function drawWedge(r, x, y, z, s = 1, rot = 0, kind = 0) {
	const tri = [0, 1, 2].map((i) => {
		const a = rot + (i === 0 ? 0 : i === 1 ? 2.55 : -2.55);
		const len = (i === 0 ? 0.09 : 0.065) * s;
		return [x + Math.cos(a) * len, y + Math.sin(a) * len];
	});
	const h = 0.045 * s;
	r.prism(tri, z, h, FOOD.cheese[kind]);
	// Rind along the wedge's curved outer edge (the two long sides meet at the tip).
	r.line([tri[1][0], tri[1][1], z + h], [tri[2][0], tri[2][1], z + h], FOOD.rind[kind], 2.4 * s);
}

export function drawTray(r, cx, cy, z, heading, s = 1, lw = 1) {
	const at = frame(cx, cy, z, heading, s);
	r.orientedBox(cx, cy, z, 0.64 * s, 0.46 * s, 0.05 * s, heading, FOOD.tray);
	r.quad([at(-0.29, -0.2, 0.051), at(0.29, -0.2, 0.051), at(0.29, 0.2, 0.051), at(-0.29, 0.2, 0.051)], FOOD.trayIn, { flat: true });
	r.line(at(-0.29, -0.2, 0.052), at(-0.29, 0.2, 0.052), FOOD.tray, 1.5 * s * lw);
}

/** The clear snap-on lid (a low dome), drawn over a tray. */
export function drawLid(r, cx, cy, z, heading, s = 1) {
	r.orientedBox(cx, cy, z + 0.05 * s, 0.66 * s, 0.48 * s, 0.04 * s, heading, FOOD.lid, { alpha: 0.45, edge: "rgba(255,255,255,0.9)" });
	r.orientedBox(cx, cy, z + 0.09 * s, 0.58 * s, 0.4 * s, 0.11 * s, heading, FOOD.lid, { alpha: 0.32, edge: "rgba(255,255,255,0.85)" });
}

/** The printed use-by and lot label on the lid. */
export function drawCode(r, cx, cy, z, heading, s = 1, lw = 1) {
	const at = frame(cx, cy, z, heading, s);
	const c = [0.17, -0.12];
	const q = [at(c[0] - 0.06, c[1] - 0.05, 0.205), at(c[0] + 0.06, c[1] - 0.05, 0.205), at(c[0] + 0.06, c[1] + 0.05, 0.205), at(c[0] - 0.06, c[1] + 0.05, 0.205)];
	r.quad(q, FOOD.label, { flat: true });
	for (let k = 0; k < 3; k++) r.line(at(c[0] - 0.045, c[1] - 0.03 + k * 0.03, 0.206), at(c[0] + 0.03 - k * 0.012, c[1] - 0.03 + k * 0.03, 0.206), "#2b2f36", 1.1 * s * lw);
}

/** A round pass (or fail) badge floating above the plate. */
export function badge(r, x, y, z, ok = true, s = 1) {
	r.billboard(x, y, z, (ctx, zoom) => {
		const k = Math.min(2.2, Math.max(0.7, zoom)) * s;
		ctx.beginPath();
		ctx.arc(0, 0, 8 * k, 0, Math.PI * 2);
		ctx.fillStyle = ok ? FOOD.pass : FOOD.fail;
		ctx.fill();
		ctx.lineWidth = 1.4 * k;
		ctx.strokeStyle = "#ffffff";
		ctx.stroke();
		ctx.beginPath();
		ctx.lineWidth = 2 * k;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		if (ok) {
			ctx.moveTo(-3.8 * k, 0.2 * k);
			ctx.lineTo(-1.1 * k, 2.9 * k);
			ctx.lineTo(4 * k, -3.1 * k);
		} else {
			ctx.moveTo(-3 * k, -3 * k);
			ctx.lineTo(3 * k, 3 * k);
			ctx.moveTo(3 * k, -3 * k);
			ctx.lineTo(-3 * k, 3 * k);
		}
		ctx.stroke();
	});
}

// ---------------------------------------------------------------------------
// Where each item sits in the tray (tray-local f, sd), so stations place items exactly there.

export const SPOT = {
	grapes: { f: -0.19, sd: 0.0, rot: Math.PI }, // left end, stem toward the tray's end wall
	// Slices stand in a row across the tray between the grapes and the pack; the row leans toward +sd.
	apples: [-0.12, -0.05, 0.02, 0.09].map((sd, i) => ({ f: -0.055, sd, tilt: i < 2 ? 0.18 : 0.32 })),
	crackers: { f: 0.07, sd: 0.02, rot: 0.6 }, // diagonal, in the center
	cheese: [
		{ f: 0.2, sd: -0.1, rot: 2.6, layer: 0, kind: 0 }, // robot A: bottom, firm
		{ f: 0.2, sd: 0.1, rot: -2.4, layer: 0, kind: 1 }, // robot A: bottom, firm
		{ f: 0.13, sd: -0.06, rot: 0.4, layer: 1, kind: 2 }, // robot B: top, firm (partly on the pack)
		{ f: 0.15, sd: 0.08, rot: -0.5, layer: 1, kind: 3 }, // robot B: top, the brie
	],
};

/**
 * Draw the tray and its contents. (cx, cy, z) is the tray's bottom center and heading its long
 * axis. contents: { grapes, apples: 0-4, crackers, cheese: 0-4, lid, code, pass: 1|2, fail }.
 */
export function drawPlate(r, cx, cy, z, heading, c = {}, opts = {}) {
	const s = opts.scale ?? 1;
	const lw = opts.lineScale ?? 1;
	const at = frame(cx, cy, z, heading, s);
	drawTray(r, cx, cy, z, heading, s, lw);
	const items = [];
	const push = (f, sd, fn) => {
		const p = at(f, sd, 0);
		items.push({ d: p[0] + p[1], fn });
	};
	const floor = 0.052;
	if (c.grapes) {
		const g = SPOT.grapes;
		push(g.f, g.sd, () => {
			const p = at(g.f, g.sd, floor);
			drawBunch(r, p[0], p[1], p[2], s, heading + g.rot, lw);
		});
	}
	const nApples = c.apples === true ? 4 : (c.apples ?? 0);
	for (let i = 0; i < nApples; i++) {
		const a = SPOT.apples[i];
		push(a.f, a.sd, () => {
			const p = at(a.f, a.sd, floor);
			drawSlice(r, p[0], p[1], p[2], s, heading, a.tilt, lw);
		});
	}
	if (c.crackers) {
		const k = SPOT.crackers;
		push(k.f, k.sd, () => {
			const p = at(k.f, k.sd, floor);
			drawPack(r, p[0], p[1], p[2], s, heading + k.rot);
		});
	}
	const nCheese = c.cheese === true ? 4 : (c.cheese ?? 0);
	for (let i = 0; i < nCheese; i++) {
		const w = SPOT.cheese[i];
		// Top-layer wedges are drawn after everything below them.
		const p0 = at(w.f, w.sd, 0);
		items.push({
			d: p0[0] + p0[1] + w.layer * 10,
			fn: () => {
				const p = at(w.f, w.sd, floor + w.layer * 0.04);
				drawWedge(r, p[0], p[1], p[2], s, heading + w.rot, w.kind);
			},
		});
	}
	items.sort((a, b) => a.d - b.d);
	for (const it of items) it.fn();
	if (c.lid) drawLid(r, cx, cy, z, heading, s);
	if (c.code) drawCode(r, cx, cy, z, heading, s, lw);
	if ((c.pass || c.fail) && !opts.noBadge) {
		const p = at(0, 0, c.lid ? 0.42 : 0.34);
		badge(r, p[0], p[1], p[2], !c.fail, opts.badgeScale ?? 1);
	}
}

/** A stack of empty nested trays (the denester magazine). */
export function drawTrayStack(r, cx, cy, z, heading, count, s = 1) {
	for (let i = 0; i < count; i++) r.orientedBox(cx, cy, z + i * 0.03 * s, 0.64 * s, 0.46 * s, 0.028 * s, heading, i % 2 ? FOOD.tray : FOOD.trayIn);
}
