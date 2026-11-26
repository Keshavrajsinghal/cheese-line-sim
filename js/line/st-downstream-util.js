// Small shared helpers for the downstream stations (st-downstream*.js, st-outfeed*.js): eased key
// frames, tray presence at a stop, and a few colors. Drawing code only; no text.

import { contents, MOVE } from "./clock.js";
import { ease, lerp } from "./common.js";

/** Eased 0..1 progress of v through [a, b]. */
export const seg = (v, a, b) => ease((v - a) / (b - a));

/**
 * Value at time w along eased key frames [[w0, v0], [w1, v1], ...] (times strictly increasing;
 * values are numbers or arrays of numbers). Held before the first frame and after the last.
 */
export function keys(frames, w) {
	if (w <= frames[0][0]) return frames[0][1];
	for (let i = 1; i < frames.length; i++) {
		const [w1, v1] = frames[i];
		if (w <= w1) {
			const [w0, v0] = frames[i - 1];
			const k = seg(w, w0, w1);
			return Array.isArray(v0) ? v0.map((q, j) => lerp(q, v1[j], k)) : lerp(v0, v1, k);
		}
	}
	return frames[frames.length - 1][1];
}

/** Whether a tray rests at position k during step n's work window (false when it was pushed off upstream). */
export const trayAt = (k, n) => contents(n - k, k, MOVE) !== null;

export const STEEL = "#c4ccd4"; // brushed stainless, lighter than PAL.steel
export const HOUSING = "#e3e8ec"; // white machine housings (bought machines)
export const BLUE = "#2f78c4"; // food-grade blue plastic: suction cups, paddles, stop blades
export const SERVO = "#2f6fb3"; // servo carriages
export const GLOW = "#fff6c8"; // inspection lighting
