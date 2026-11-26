// Apple station: hopper, shaker, pick belt, camera, return tote, two six-axis arms.
// Stub: draws placeholder blocks until the detailed drawing lands. Drawing code only; no text.

import { buildPlaceholders } from "./placeholder.js";

export function build(scene, ctx) {
	buildPlaceholders(scene, ctx, null, ["apples"]);
}
