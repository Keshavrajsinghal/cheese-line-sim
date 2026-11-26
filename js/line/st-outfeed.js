// Outfeed gantry, the two rack cart slots with light curtains, carts in dispatch staging.
// Stub: draws placeholder blocks until the detailed drawing lands. Drawing code only; no text.

import { buildPlaceholders } from "./placeholder.js";

export function build(scene, ctx) {
	buildPlaceholders(scene, ctx, null, ["outfeed"]);
}
