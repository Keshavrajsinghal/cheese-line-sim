// Accumulation conveyor gates, both inspections, pushers, reject lanes, re-entry chutes, rework tables, lidding machine, coder.
// Stub: draws placeholder blocks until the detailed drawing lands. Drawing code only; no text.

import { buildPlaceholders } from "./placeholder.js";

export function build(scene, ctx) {
	buildPlaceholders(scene, ctx, null, ["inspect1","lidding","inspect2","rework-1","rework-2"]);
}
