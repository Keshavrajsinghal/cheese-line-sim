// Map targets for the places that are not ride stops: the supply aisle, staging, both rework
// tables, the cart slots, dispatch, and the controller cabinet. Drawing of these lives in the
// plant and station modules; this file only places their labels and hit areas.

import { AISLE, CABINET, CART_SLOTS, DISPATCH, REWORK, STAGING } from "./layout.js";

export function buildPlaceTargets(scene, ctx) {
	ctx.placeTarget("supply-aisle", [AISLE.x0, 26, 0, AISLE.x1, 32, 0.3], [(AISLE.x0 + AISLE.x1) / 2, 30, 0.2]);
	ctx.placeTarget("staging", [STAGING.x0, STAGING.y0, 0, STAGING.x1, STAGING.y1, 2.0], [(STAGING.x0 + STAGING.x1) / 2, 18, 2.4]);
	for (const id of ["rework-1", "rework-2"]) {
		const t = REWORK[id];
		ctx.placeTarget(id, [t.x0, t.y0, 0, t.x1, t.y1, 1.2], [(t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, 1.5]);
	}
	const s0 = CART_SLOTS[0];
	const s1 = CART_SLOTS[1];
	ctx.placeTarget("cart-slots", [s0.x0, s0.y0, 0, s1.x1, s1.y1, 1.4], [(s0.x0 + s0.x1) / 2, (s0.y0 + s1.y1) / 2, 2.9]);
	ctx.placeTarget("dispatch", [DISPATCH.x0, DISPATCH.y0, 0, DISPATCH.x1, DISPATCH.y1, 0.5], [(DISPATCH.x0 + DISPATCH.x1) / 2, (DISPATCH.y0 + DISPATCH.y1) / 2, 0.3]);
	ctx.placeTarget("cabinet", [CABINET.x0, CABINET.y0, 0, CABINET.x1, CABINET.y1, 2.2], [(CABINET.x0 + CABINET.x1) / 2, (CABINET.y0 + CABINET.y1) / 2, 2.5]);
}
