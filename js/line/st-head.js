// Head of the line: the tray denester, the grape station, and the cracker station.
// Each station lives in its own st-head-*.js file; this module calls them. Drawing code only; no text.

import { buildCrackers } from "./st-head-crackers.js";
import { buildDenester } from "./st-head-denester.js";
import { buildGrapes } from "./st-head-grapes.js";

export function build(scene, ctx, T) {
	buildDenester(scene, ctx, T);
	buildGrapes(scene, ctx, T);
	buildCrackers(scene, ctx, T);
}
