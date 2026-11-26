// The tray ride: a cart on a raised track along the front of the line follows one tray from the
// denester to the rack cart. This module provides the track, the scenery of the line itself, the
// cargo drawn on the cart, and the close-up in the stop panel. Drawing code only: every word on
// screen (stop titles, cargo tags) comes from content.

import { IsoRenderer } from "../engine/iso.js";
import { buildBelts, buildTrays } from "./belts.js";
import { CYCLE, MOVE } from "./clock.js";
import { drawPlate, PLATE_AFTER } from "./food.js";
import { HEADING, STOP_Y, TRACK } from "./layout.js";
import { STATION_BUILDERS } from "./stations.js";

const STOP_IDS = Object.keys(STOP_Y);

export default {
	id: "line",

	trackFor() {
		// One way along the front of the line; "Ride again" returns the cart to the start.
		const X = TRACK.out;
		const z = TRACK.z;
		const points = [[X, 3.4, z]];
		const stops = {};
		for (const id of STOP_IDS) {
			stops[id] = points.length;
			points.push([X, STOP_Y[id], z]);
		}
		points.push([X, 53.4, z], [X + 0.5, 54.9, z]);
		return { points, stops };
	},

	buildScenery(scene, ctx) {
		// Line time starts in steady state (step 40), so every tray on screen has a history: the
		// carts hold its plates and the rework tables its rejects.
		const T = (t) => (ctx.reducedMotion() ? FROZEN : t + START);
		buildBelts(scene, ctx);
		buildTrays(scene, ctx, T);
		for (const build of STATION_BUILDERS) build(scene, ctx, T);
	},

	/** Aim past the belt toward the robots, so the station that changed the tray is in view beside the cart. */
	focus(pos) {
		return [pos.x - 2.8, pos.y, 1.2];
	},

	drawCargo(r, stopId, pos) {
		const [x, y, z] = pos.anchor;
		drawPlate(r, x, y, z, pos.heading, PLATE_AFTER[stopId] ?? {}, { scale: 1.45 });
	},

	closeup(stopId, el) {
		const canvas = document.createElement("canvas");
		canvas.className = "closeup-canvas";
		canvas.setAttribute("aria-hidden", "true");
		el.append(canvas);
		const draw = () => {
			const w = el.clientWidth || 320;
			const h = 150;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			const c = canvas.getContext("2d");
			c.setTransform(dpr, 0, 0, dpr, 0, 0);
			const r = new IsoRenderer(c);
			r.setTransform(6.2, w / 2, h / 2 + 14);
			r.shadow(0, 0, 0.5, 0.4, 0.15);
			drawPlate(r, 0, 0, 0, HEADING, PLATE_AFTER[stopId] ?? {}, { lineScale: 0.28, badgeScale: 0.8 });
		};
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(el);
		return () => {
			ro.disconnect();
			canvas.remove();
		};
	},
};

const START = 40 * CYCLE;
/** Pose shown when motion is reduced: mid-step, robots busy, trays still. */
const FROZEN = START + MOVE + 2.1;
