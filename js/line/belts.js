// The tray belt (indexing, through the pick stations), the accumulation conveyor after cheese with
// its stop gates, and the trays riding on them, driven by the shared clock. Drawing code only.

import { CYCLE, clock, contents, LAST, MOVE, POS, trayY } from "./clock.js";
import { object, PAL } from "./common.js";
import { drawPlate } from "./food.js";
import { ACC, BELT, BELT_Z, HEADING, INDEX_END, LINE_X, Y0 } from "./layout.js";

const BELT_START = Y0 - 1.2;

function beltPiece(r, y0, y1, color, legs = true) {
	const [x0, x1] = BELT;
	if (legs) {
		r.box(x0 + 0.05, y0 + 0.1, 0, 0.1, 0.1, BELT_Z - 0.12, PAL.steelDark);
		r.box(x1 - 0.15, y0 + 0.1, 0, 0.1, 0.1, BELT_Z - 0.12, PAL.steelDark);
	}
	r.box(x0, y0, BELT_Z - 0.16, x1 - x0, y1 - y0, 0.14, PAL.steel);
	r.ground(x0 + 0.08, y0, x1 - x0 - 0.16, y1 - y0, color, BELT_Z - 0.01);
	r.box(x0 - 0.04, y0, BELT_Z - 0.06, 0.1, y1 - y0, 0.14, PAL.steelDark);
	r.box(x1 - 0.06, y0, BELT_Z - 0.06, 0.1, y1 - y0, 0.14, PAL.steelDark);
}

/** Static belt frames, split into short pieces so depth sorting stays right. */
export function buildBelts(scene, ctx) {
	const g = ctx.group;
	for (let y = BELT_START; y < INDEX_END; y += 1.6) {
		const y1 = Math.min(INDEX_END, y + 1.6);
		object(scene, BELT[0], y, BELT[1], y1, BELT_Z, (r) => beltPiece(r, y, y1, PAL.beltBlue), { group: g });
	}
	for (let y = ACC.y0 + 0.05; y < ACC.y1; y += 1.6) {
		const y1 = Math.min(ACC.y1, y + 1.6);
		object(scene, BELT[0], y, BELT[1], y1, BELT_Z, (r) => {
			beltPiece(r, y, y1, PAL.belt);
			// Rollers of the accumulation conveyor.
			for (let ry = y + 0.15; ry < y1; ry += 0.3) r.line([BELT[0] + 0.12, ry, BELT_Z], [BELT[1] - 0.12, ry, BELT_Z], "#5b636e", 1.2);
		}, { group: g });
	}
}

/** Belt pockets moving with the indexing belt, and one tray per position. */
export function buildTrays(scene, ctx, T) {
	const g = ctx.group;
	// Pocket cleats on the indexing belt (they move with it).
	scene.addDynamic({
		group: g,
		depth: () => LINE_X + (Y0 + INDEX_END) / 2 - 40,
		bounds: [BELT[0], BELT_START, BELT_Z, BELT[1], INDEX_END, BELT_Z + 0.1],
		animated: () => true,
		draw: (r, t0) => {
			const { u } = clock(T(t0));
			const shift = u < MOVE ? (u / MOVE) * (POS[1] - POS[0]) : 0;
			for (let y = BELT_START + 0.35 + shift; y < INDEX_END - 0.05; y += POS[1] - POS[0]) {
				for (const dy of [-0.36, 0.36]) {
					const yy = y + dy;
					if (yy > BELT_START + 0.05 && yy < INDEX_END - 0.05) r.box(BELT[0] + 0.12, yy - 0.03, BELT_Z - 0.01, BELT[1] - BELT[0] - 0.24, 0.06, 0.05, "#1f4f82");
				}
			}
		},
	});
	for (let k = 0; k <= LAST; k++) {
		const yNow = () => trayY(k, clock(T(scene.time)).u);
		scene.addDynamic({
			group: g,
			depth: () => LINE_X + yNow(),
			bounds: () => {
				const y = yNow();
				return [LINE_X - 0.5, y - 0.45, BELT_Z, LINE_X + 0.5, y + 0.45, BELT_Z + 0.5];
			},
			animated: () => true,
			draw: (r, t0) => {
				const { n, u } = clock(T(t0));
				const m = n - k;
				if (k === 0) return; // the denester draws the tray it is releasing
				const c = contents(m, k, u);
				if (!c) return;
				drawPlate(r, LINE_X, trayY(k, u), BELT_Z, HEADING, c);
			},
		});
	}
	void CYCLE;
}
