// Tray denester, grape station, and cracker station.
// Stub: draws placeholder blocks until the detailed drawing lands. Drawing code only; no text.

import { buildPlaceholders } from "./placeholder.js";

export function build(scene, ctx) {
	buildPlaceholders(scene, ctx, null, ["denester","grapes","crackers"]);
}
