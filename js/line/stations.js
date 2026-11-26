// The list of builders the ride calls, plus the map targets (stop labels and hit areas) for every
// stop. Builder contract: build(scene, ctx, T) where T(t) maps scene time to line time (frozen
// under reduced motion). Tag everything with group: ctx.group. See ARCHITECTURE.md.

import { BELT_Z, LINE_X, STATION, STOP_Y } from "./layout.js";
import { buildPeople } from "./people.js";
import { buildPlaceTargets } from "./places.js";
import { build as buildApples } from "./st-apples.js";
import { build as buildCheese } from "./st-cheese.js";
import { build as buildDownstream } from "./st-downstream.js";
import { build as buildHead } from "./st-head.js";
import { build as buildOutfeed } from "./st-outfeed.js";

/** Stop labels and hit areas: behind the belt for pick stations, over the conveyor after. */
function buildStopTargets(scene, ctx) {
	const pick = new Set(["denester", "grapes", "apples-a", "apples-b", "crackers", "cheese-a", "cheese-b"]);
	for (const [id, y] of Object.entries(STOP_Y)) {
		if (id === "outfeed") {
			const o = STATION.outfeed;
			ctx.stopTarget(id, [o.x0, 44.4, 0, o.x1, 53.2, 2.6], [10.7, 47.6, 3.0]);
			continue;
		}
		const isPick = pick.has(id);
		ctx.stopTarget(id, [isPick ? 6.4 : 9.6, y - 0.8, 0, 12.6, y + 0.8, isPick ? 2.4 : 2.0], [isPick ? 8.4 : LINE_X - 0.6, y, isPick ? 2.9 : BELT_Z + 1.9]);
	}
	// Where the camera looks when a station's full design section is open.
	const focus = { denester: "denester", grapes: "grapes", apples: "apples-a", crackers: "crackers", cheese: "cheese-a", "inspect-1": "inspect-1", lidding: "lidding", "inspect-2": "inspect-2", outfeed: "outfeed" };
	for (const [station, stop] of Object.entries(focus)) ctx.stationFocus(station, [LINE_X - 1.5, STOP_Y[stop], 0]);
}

export const STATION_BUILDERS = [buildHead, buildApples, buildCheese, buildDownstream, buildOutfeed, buildStopTargets, buildPlaceTargets, buildPeople];
