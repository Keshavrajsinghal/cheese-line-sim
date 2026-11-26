// The building around the line: cold room floor and walls, the supply aisles, the guard fence,
// supply staging, the warm corridor with its door, and the dispatch area. Stations draw
// themselves (js/line/stations-*.js). Drawing code only; no text.

import { LAYER } from "../engine/scene.js";
import { guardRun, object, PAL } from "./common.js";
import { AISLE, CART_SLOTS, DISPATCH, DOOR, GUARD, HEAD_AISLE, LANES, ROOM, STAGING, STATION, WARM } from "./layout.js";

const G = "plant";

function buildFloors(scene) {
	const { x0, y0, x1, y1 } = ROOM;
	scene.add({
		layer: LAYER.TERRAIN,
		depth: -100,
		group: G,
		bounds: [x0 - 1, y0 - 1, 0, WARM.x1 + 1, y1 + 1, 0.02],
		draw: (r) => {
			r.ground(x0 - 0.3, y0 - 0.3, x1 - x0 + 0.6, y1 - y0 + 0.6, "#b9c0c6", 0.005);
			r.ground(x0, y0, x1 - x0, y1 - y0, PAL.floor, 0.01);
			if (r.zoom >= 0.35)
				for (let x = x0; x < x1; x += 2) for (let y = y0; y < y1; y += 2) if (((x - x0) / 2 + (y - y0) / 2) % 2 === 0) r.ground(x, y, 2, 2, PAL.floor2, 0.012);
			// Warm corridor (outside the cold room).
			r.ground(WARM.x0, WARM.y0, WARM.x1 - WARM.x0, WARM.y1 - WARM.y0, PAL.warmFloor, 0.01);
		},
	});
	scene.add({
		layer: LAYER.GROUND,
		depth: -90,
		group: G,
		bounds: [x0, y0, 0, x1, y1, 0.03],
		draw: (r) => {
			// Supply aisles: lighter walkway with yellow edge lines.
			for (const a of [AISLE, HEAD_AISLE]) r.ground(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0, PAL.aisle, 0.018);
			const yl = (pts) => r.polyline(pts.map(([x, y]) => [x, y, 0.025]), PAL.aisleLine, 2.2);
			yl([
				[AISLE.x1, AISLE.y1],
				[AISLE.x1, HEAD_AISLE.y1],
				[HEAD_AISLE.x1, HEAD_AISLE.y1],
			]);
			yl([
				[AISLE.x0, AISLE.y1],
				[AISLE.x0, HEAD_AISLE.y0],
				[HEAD_AISLE.x1, HEAD_AISLE.y0],
			]);
			// Front walkway (Operator 2) and dispatch staging, outlined.
			r.ground(13.3, 30.5, 6.2 - 0.3, 24.5, PAL.aisle, 0.018);
			yl([
				[DISPATCH.x0, DISPATCH.y0],
				[DISPATCH.x1, DISPATCH.y0],
				[DISPATCH.x1, DISPATCH.y1],
				[DISPATCH.x0, DISPATCH.y1],
				[DISPATCH.x0, DISPATCH.y0],
			]);
			// Hatched keep-clear zones in front of each cart slot's light curtain.
			for (const s of CART_SLOTS)
				for (let y = s.y0 + 0.2; y < s.y1 - 0.2; y += 0.5)
					r.polyline(
						[
							[s.curtain + 0.1, y, 0.026],
							[s.curtain + 0.9, y + 0.35, 0.026],
						],
						PAL.aisleLine,
						2,
					);
			// Floor drains along the line (daily washdown).
			for (let y = 8; y < 46; y += 6) r.ground(12.25, y, 0.35, 1.2, "#9aa3ad", 0.022);
		},
	});
}

function buildWalls(scene) {
	const { x0, y0, x1, y1 } = ROOM;
	const tall = 3.4;
	const low = 0.6;
	const t = 0.3;
	// Back walls (tall, insulated panels): along y at x = x0, along x at y = y0.
	for (let y = y0; y < y1; y += 2) {
		const d = Math.min(2, y1 - y);
		object(scene, x0 - t, y, x0, y + d, tall, (r) => {
			r.box(x0 - t, y, 0, t, d, tall, PAL.wall);
			r.quad(
				[
					[x0 + 0.01, y + 0.02, 2.6],
					[x0 + 0.01, y + d - 0.02, 2.6],
					[x0 + 0.01, y + d - 0.02, 2.85],
					[x0 + 0.01, y + 0.02, 2.85],
				],
				PAL.wallBand,
				{ flat: true },
			);
			r.box(x0, y + d - 0.06, 0, 0.06, 0.06, tall, "#d5dbe0");
		}, { group: G });
	}
	for (let x = x0 - t; x < x1; x += 2) {
		const w = Math.min(2, x1 - x);
		object(scene, x, y0 - t, x + w, y0, tall, (r) => {
			r.box(x, y0 - t, 0, w, t, tall, PAL.wall);
			r.quad(
				[
					[x + 0.02, y0 + 0.01, 2.6],
					[x + w - 0.02, y0 + 0.01, 2.6],
					[x + w - 0.02, y0 + 0.01, 2.85],
					[x + 0.02, y0 + 0.01, 2.85],
				],
				PAL.wallBand,
				{ flat: true },
			);
		}, { group: G });
	}
	// Front walls (low cutaway so the line stays visible): x = x1 with the corridor door, y = y1.
	for (let y = y0; y < y1; y += 2) {
		const d = Math.min(2, y1 - y);
		const pieces = [];
		if (y + d <= DOOR.y0 || y >= DOOR.y1) pieces.push([y, d]);
		else {
			if (y < DOOR.y0) pieces.push([y, DOOR.y0 - y]);
			if (y + d > DOOR.y1) pieces.push([DOOR.y1, y + d - DOOR.y1]);
		}
		for (const [py, pd] of pieces) object(scene, x1, py, x1 + t, py + pd, low, (r) => r.box(x1, py, 0, t, pd, low, PAL.wall, { top: PAL.wallBand }), { group: G });
	}
	// Door frame (strip curtain) into the cold room.
	object(scene, x1, DOOR.y0, x1 + t, DOOR.y1, 2.3, (r) => {
		r.box(x1, DOOR.y0 - 0.08, 0, t, 0.08, 2.3, PAL.steelDark);
		r.box(x1, DOOR.y1, 0, t, 0.08, 2.3, PAL.steelDark);
		r.box(x1, DOOR.y0 - 0.08, 2.2, t, DOOR.y1 - DOOR.y0 + 0.16, 0.12, PAL.steelDark);
		for (let y = DOOR.y0 + 0.1; y < DOOR.y1 - 0.05; y += 0.22) r.quad([[x1 + 0.15, y, 0.05], [x1 + 0.15, y + 0.18, 0.05], [x1 + 0.15, y + 0.18, 2.18], [x1 + 0.15, y, 2.18]], "#d6ecf5", { alpha: 0.45 });
	}, { group: G });
	for (let x = x0 - t; x < x1 + t; x += 2) {
		const w = Math.min(2, x1 + t - x);
		// Gap where full carts leave for the cold store.
		if (x + w > DISPATCH.x0 + 1 && x < DISPATCH.x1 - 0.5) continue;
		object(scene, x, y1, x + w, y1 + t, low, (r) => r.box(x, y1, 0, w, t, low, PAL.wall, { top: PAL.wallBand }), { group: G });
	}
	// Warm corridor walls (low), outside the cold room.
	object(scene, WARM.x1, WARM.y0, WARM.x1 + t, WARM.y1, low, (r) => r.box(WARM.x1, WARM.y0, 0, t, WARM.y1 - WARM.y0, low, PAL.warmWall, { top: PAL.warmBand }), { group: G });
	object(scene, WARM.x0, WARM.y0 - t, WARM.x1 + t, WARM.y0, 2.6, (r) => r.box(WARM.x0, WARM.y0 - t, 0, WARM.x1 + t - WARM.x0, t, 2.6, PAL.warmWall, { top: PAL.warmBand }), { group: G });
	object(scene, WARM.x0, WARM.y1, WARM.x1 + t, WARM.y1 + t, low, (r) => r.box(WARM.x0, WARM.y1, 0, WARM.x1 + t - WARM.x0, t, low, PAL.warmWall, { top: PAL.warmBand }), { group: G });
}

/** Supply staging racks along the back wall: what prep delivers, waiting for Operator 1. */
function buildStaging(scene) {
	const { x0, x1, y0, y1 } = STAGING;
	const bays = [
		{ y: 6.6, kind: "trays" },
		{ y: 9.8, kind: "pocket" },
		{ y: 13.0, kind: "apples" },
		{ y: 16.2, kind: "packs" },
		{ y: 19.4, kind: "cheese" },
		{ y: 22.6, kind: "cheese" },
		{ y: 25.8, kind: "empties" },
		{ y: 36.4, kind: "lids" },
	];
	for (const b of bays) {
		const by0 = b.y;
		const by1 = b.y + 2.6;
		if (by1 > y1) continue;
		object(scene, x0, by0, x1, by1, 2.0, (r) => {
			const legs = [
				[x0 + 0.05, by0 + 0.05],
				[x1 - 0.15, by0 + 0.05],
				[x0 + 0.05, by1 - 0.15],
				[x1 - 0.15, by1 - 0.15],
			];
			for (const [lx, ly] of legs.slice(0, 2)) r.box(lx, ly, 0, 0.1, 0.1, 1.9, PAL.rack);
			for (const z of [0.25, 1.05]) {
				r.box(x0, by0, z, x1 - x0, by1 - by0, 0.05, PAL.steel);
				drawStock(r, b.kind, x0 + 0.2, by0 + 0.2, z + 0.05, x1 - x0 - 0.4, by1 - by0 - 0.4);
			}
			r.box(x0, by0, 1.85, x1 - x0, by1 - by0, 0.05, PAL.steel);
			for (const [lx, ly] of legs.slice(2)) r.box(lx, ly, 0, 0.1, 0.1, 1.9, PAL.rack);
		}, { group: G });
	}
	void y0;
}

function drawStock(r, kind, x, y, z, w, d) {
	if (kind === "trays") for (let i = 0; i < 2; i++) r.box(x + 0.1, y + i * (d / 2) + 0.05, z, w - 0.2, d / 2 - 0.15, 0.55, "#c9ae80", { top: "#d8c09a" });
	else if (kind === "pocket") for (let i = 0; i < 2; i++) for (let k = 0; k < 5; k++) r.box(x + 0.05, y + i * (d / 2) + 0.05, z + k * 0.1, w - 0.1, d / 2 - 0.15, 0.08, PAL.pocketTray, { top: k === 4 ? "#6f2f8f" : undefined });
	else if (kind === "apples") for (let i = 0; i < 2; i++) r.box(x + 0.1, y + i * (d / 2) + 0.1, z, w - 0.2, d / 2 - 0.25, 0.4, "#e9eef2", { top: "#f3e6b8" });
	else if (kind === "packs") for (let i = 0; i < 3; i++) r.box(x + 0.1, y + i * (d / 3) + 0.05, z, w - 0.2, d / 3 - 0.12, 0.35, "#e9edf1", { top: "#d8dde3" });
	else if (kind === "cheese") for (let i = 0; i < 2; i++) for (let k = 0; k < 4; k++) r.box(x + 0.05, y + i * (d / 2) + 0.05, z + k * 0.1, w - 0.1, d / 2 - 0.15, 0.08, PAL.cheeseTray[(i * 2 + k) % 4]);
	else if (kind === "empties") for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) r.box(x + 0.05, y + i * (d / 2) + 0.05, z + k * 0.1, w - 0.1, d / 2 - 0.15, 0.08, i ? PAL.cheeseTray[k] : PAL.pocketTray, { alpha: 0.85 });
	else if (kind === "lids") for (let i = 0; i < 2; i++) r.box(x + 0.15, y + i * (d / 2) + 0.1, z, w - 0.3, d / 2 - 0.3, 0.6, "#e9f5fb", { alpha: 0.6, edge: "rgba(255,255,255,0.9)" });
}

/** Guard fence: back line with a loading opening at every feeder, the head, and the front line. */
function buildGuard(scene) {
	const h = GUARD.h;
	const bx = GUARD.back;
	const fx = GUARD.front;
	// Loading openings in the back guard: each feeder's magazine or hopper is filled from the aisle.
	const backGaps = [
		[STATION.grapes.y0 + 0.2, STATION.grapes.y1 - 0.2],
		[STATION.apples.y0 + 0.4, STATION.apples.y0 + 1.6],
		[STATION.crackers.y0 + 0.4, STATION.crackers.y1 - 0.4],
		[STATION.cheese.y0, STATION.cheese.y1],
		[STATION.lidding.y0 + 0.3, STATION.lidding.y1 - 0.3],
	];
	for (let y = GUARD.head; y < 46; y += 4) {
		const y1 = Math.min(46, y + 4);
		const gaps = backGaps.map(([a, b]) => [a - y, b - y]).filter(([a, b]) => b > 0 && a < y1 - y);
		object(scene, bx - 0.1, y, bx + 0.1, y1, h, (r) => guardRun(r, bx, y, bx, y1, h, { gaps }), { group: G });
	}
	// Head of the line: the denester magazine opens to the head aisle.
	const denGap = [[STATION.denester.x0 - bx + 0.3, STATION.denester.x1 - bx - 0.3]];
	object(scene, bx, GUARD.head - 0.1, fx, GUARD.head + 0.1, h, (r) => guardRun(r, bx, GUARD.head, fx, GUARD.head, h, { gaps: denGap }), { group: G });
	// Front guard: openings only for the reject lanes and at the cart slots (light curtains).
	for (let y = GUARD.head; y < 45.6; y += 4) {
		const y1 = Math.min(45.6, y + 4);
		const gaps = LANES.map((l) => [l.y - 0.45 - y, l.y + 0.45 - y]).filter(([a, b]) => b > 0 && a < y1 - y);
		object(scene, fx - 0.1, y, fx + 0.1, y1, h, (r) => guardRun(r, fx, y, fx, y1, h, { gaps }), { group: G, live: true });
	}
	// Back of the outfeed and the far end.
	object(scene, bx, 45.9, bx + 0.2, 53.6, h, (r) => guardRun(r, bx, 46, bx, 53.5, h), { group: G });
	object(scene, bx, 53.4, fx, 53.6, h, (r) => guardRun(r, bx, 53.5, CART_SLOTS[0].x0, 53.5, h), { group: G });
}

export function buildPlant(scene) {
	buildFloors(scene);
	buildWalls(scene);
	buildStaging(scene);
	buildGuard(scene);
}
