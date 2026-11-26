// Placeholder blocks for stations not drawn in detail yet. Each detailed station module replaces
// its entry here. Drawing code only.

import { object, PAL } from "./common.js";
import { REWORK, STATION } from "./layout.js";

const BLOCKS = {
	denester: { ...STATION.denester, h: 1.6, color: PAL.steel },
	grapes: { ...STATION.grapes, h: 2.0, color: "#9db7c9" },
	apples: { ...STATION.apples, h: 2.2, color: "#c9b79d" },
	crackers: { ...STATION.crackers, h: 1.4, color: "#b9c9b0" },
	cheese: { ...STATION.cheese, h: 2.2, color: "#e1d29a" },
	inspect1: { ...STATION.inspect1, h: 1.9, color: "#9aa8c9" },
	lidding: { ...STATION.lidding, h: 1.8, color: "#c9a8b4" },
	inspect2: { ...STATION.inspect2, h: 1.9, color: "#9aa8c9" },
	outfeed: { ...STATION.outfeed, h: 2.4, color: "#d9b38a" },
	"rework-1": { ...REWORK["rework-1"], h: 0.9, color: PAL.steel },
	"rework-2": { ...REWORK["rework-2"], h: 0.9, color: PAL.steel },
};

/** Draw placeholder blocks for the given station ids (all of them when `only` is omitted). */
export function buildPlaceholders(scene, ctx, skip = null, only = null) {
	for (const [id, b] of Object.entries(BLOCKS)) {
		if (skip?.has(id) || (only && !only.includes(id))) continue;
		object(scene, b.x0, b.y0, b.x1, b.y1, b.h, (r) => r.box(b.x0, b.y0, 0, b.x1 - b.x0, b.y1 - b.y0, b.h, b.color, { alpha: 0.55 }), { group: ctx.group });
	}
}
