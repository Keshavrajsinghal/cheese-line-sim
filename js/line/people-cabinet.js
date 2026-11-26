// The heated controller cabinet in the warm corridor: one controller per robot (the grape delta,
// the two apple six-axis arms, the two cheese deltas, the gantry), the line PLC, and the gripper
// air controls, with a heater / cooling unit on the roof, status lamps, and the HMI screen the
// technician checks. A cable tray leaves the cabinet top, passes through the cold room wall
// (x = 21), and runs overhead to a junction box on the front guard. Drawing code only; no text.

import { object, PAL } from "./common.js";
import { CABINET, GUARD, POSTS } from "./layout.js";

const PAINT = "#d6d9d5"; // painted steel (light grey)
const SEAM = "#9da4ab";
const PLINTH = "#454b53";
const GALV = "#a9b1b8"; // galvanised tray in the corridor
const LAMP = { green: "#58e08f", amber: "#7d6a3a", red: "#7a3a36", off: "#59606a" };

/** Cabinet sections along y: what each one is and how tall it stands. */
const SECTIONS = [
	{ kind: "air", w: 0.9, h: 2.0 },
	{ kind: "delta", w: 0.7, h: 1.8 }, // grape delta
	{ kind: "arm", w: 0.8, h: 2.0 }, // apple arm A
	{ kind: "arm", w: 0.8, h: 2.0 }, // apple arm B
	{ kind: "delta", w: 0.7, h: 1.8 }, // cheese delta A
	{ kind: "delta", w: 0.7, h: 1.8 }, // cheese delta B
	{ kind: "gantry", w: 0.7, h: 2.0 },
	{ kind: "plc", w: 0.7, h: 2.0 },
];

const TRAY_Y = 12.0; // the tray turns toward the line here (a guard post stands at y = 12.0)
const TRAY_W = 0.34;
const TRAY_Z = 2.45; // over the cabinet and through the wall
const HIGH_Z = 4.2; // overhead in the cold room, clear of the ride
const DROP_X = 13.2; // where it comes down beside the front guard

/** The HMI screen on its swing arm at the cabinet's near end, turned toward the technician. */
const HMI_C = [CABINET.x1 + 0.3, CABINET.y1 + 0.42, 1.5];
export const HMI = { x: HMI_C[0], y: HMI_C[1], z: HMI_C[2], angle: Math.atan2(POSTS.technician[1] - HMI_C[1], POSTS.technician[0] - HMI_C[0]) };

const face = (x, y0, y1, z0, z1) => [
	[x, y0, z0],
	[x, y1, z0],
	[x, y1, z1],
	[x, y0, z1],
];

function door(r, x, y0, y1, h, sec) {
	const fx = x + 0.004;
	const w = y1 - y0;
	// Door outline, handle, and vents.
	r.polyline([[fx, y0 + 0.03, 0.14], [fx, y1 - 0.03, 0.14], [fx, y1 - 0.03, h - 0.04], [fx, y0 + 0.03, h - 0.04]], SEAM, 0.9, true);
	r.box(x, y1 - 0.12, 0.95, 0.035, 0.035, 0.24, PAL.dark);
	for (let k = 0; k < 3; k++) {
		const z = 0.32 + k * 0.06;
		r.line([fx, y0 + 0.15, z], [fx, y1 - 0.2, z], "#a8afb6", 1);
	}
	const mid = (y0 + y1) / 2 - 0.04;
	if (sec.kind === "delta" || sec.kind === "arm") {
		// Main isolator (yellow plate, red handle), status lamp, and on arms the teach pendant.
		r.quad(face(fx, mid - 0.09, mid + 0.09, 1.28, 1.46), "#f2c230", { flat: true });
		r.box(x, mid - 0.025, 1.33, 0.05, 0.05, 0.09, PAL.danger);
		r.sphere(fx + 0.02, mid, 1.66, 0.035, LAMP.green, 0, { flat: true });
		if (sec.kind === "arm") {
			r.box(x, y0 + 0.1, 0.92, 0.06, 0.2, 0.27, "#3a3f47", { top: "#565d66" });
			r.quad(face(fx + 0.062, y0 + 0.13, y0 + 0.27, 1.03, 1.15), "#2a5f86", { flat: true });
			r.polyline([[fx + 0.04, y0 + 0.2, 0.92], [fx + 0.09, y0 + 0.26, 0.6], [fx + 0.06, y0 + 0.45, 0.5], [fx + 0.02, y0 + 0.55, 0.8]], "#2b2f36", 1.4);
		}
	} else if (sec.kind === "gantry") {
		// Servo drives behind a window.
		r.quad(face(fx, y0 + 0.12, y1 - 0.18, 1.05, 1.6), "#2a323b", { flat: true });
		for (let k = 0; k < 4; k++) {
			const yy = y0 + 0.17 + k * ((w - 0.38) / 4);
			r.quad(face(fx + 0.002, yy, yy + 0.07, 1.12, 1.5), "#4d5865", { flat: true });
			r.sphere(fx + 0.01, yy + 0.035, 1.44, 0.012, LAMP.green, 0, { flat: true });
		}
	} else if (sec.kind === "plc") {
		// PLC rack behind a window, an emergency stop below it.
		r.quad(face(fx, y0 + 0.1, y1 - 0.16, 1.2, 1.62), "#2a323b", { flat: true });
		const cols = ["#3f8fd2", "#4d5865", "#4d5865", "#5fa05f", "#4d5865", "#d0a03a"];
		for (let k = 0; k < cols.length; k++) {
			const yy = y0 + 0.13 + k * 0.065;
			r.quad(face(fx + 0.002, yy, yy + 0.05, 1.28, 1.52), cols[k], { flat: true });
		}
		r.box(x, mid - 0.07, 0.98, 0.04, 0.14, 0.14, "#f2c230");
		r.cylinder(x + 0.07, mid, 1.03, 0.045, 0.05, PAL.danger, 8);
	} else if (sec.kind === "air") {
		// Gripper air controls: valve manifold and regulator gauges behind a window.
		r.quad(face(fx, y0 + 0.1, y1 - 0.18, 0.95, 1.65), "#2a323b", { flat: true });
		for (let k = 0; k < 6; k++) {
			const yy = y0 + 0.14 + k * 0.085;
			r.quad(face(fx + 0.002, yy, yy + 0.06, 1.12, 1.28), k % 2 ? "#2f6fb3" : "#3c4550", { flat: true });
		}
		for (let k = 0; k < 3; k++) r.sphere(fx + 0.01, y0 + 0.2 + k * 0.17, 1.48, 0.045, "#f4f6f8", 0, { flat: true });
		r.line([fx + 0.004, y0 + 0.14, 1.32], [fx + 0.004, y1 - 0.22, 1.32], "#2f9ad8", 2);
	}
}

/** Ladder-type cable tray from a to b (axis aligned, horizontal or vertical) with cables in it. */
function trayRun(r, a, b, color, opts = {}) {
	const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
	const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
	const [z0, z1] = [Math.min(a[2], b[2]), Math.max(a[2], b[2])];
	const hw = TRAY_W / 2;
	if (z1 - z0 > 0.01) {
		// Vertical riser: a channel with the cable bundle in front of it.
		r.box(x0 - 0.1, y0 - hw, z0, 0.2, TRAY_W, z1 - z0, color, opts);
		r.box(x0 + 0.1, y0 - hw + 0.08, z0, 0.03, TRAY_W - 0.16, z1 - z0, "#5b626b", opts);
		return;
	}
	const alongX = x1 - x0 > y1 - y0;
	const bx0 = alongX ? x0 : x0 - hw;
	const by0 = alongX ? y0 - hw : y0;
	const bw = alongX ? x1 - x0 : TRAY_W;
	const bd = alongX ? TRAY_W : y1 - y0;
	r.box(bx0 + (alongX ? 0 : 0.06), by0 + (alongX ? 0.06 : 0), z0 + 0.015, bw - (alongX ? 0 : 0.12), bd - (alongX ? 0.12 : 0), 0.045, "#2f343b", { ...opts, top: "#3a4048" });
	r.box(bx0, by0, z0, bw, bd, 0.02, color, opts);
	if (alongX) {
		r.box(bx0, by0, z0, bw, 0.025, 0.08, color, opts);
		r.box(bx0, by0 + bd - 0.025, z0, bw, 0.025, 0.08, color, opts);
	} else {
		r.box(bx0, by0, z0, 0.025, bd, 0.08, color, opts);
		r.box(bx0 + bw - 0.025, by0, z0, 0.025, bd, 0.08, color, opts);
	}
}

function drawHmi(r) {
	const { x, y, z, angle: a } = HMI;
	const n = [Math.cos(a), Math.sin(a)];
	const tg = [-Math.sin(a), Math.cos(a)];
	// Swing arm from the cabinet's end panel.
	const root = [CABINET.x1 - 0.12, CABINET.y1, z - 0.05];
	const elbow = [x - n[0] * 0.18, y - n[1] * 0.18, z - 0.05];
	r.tube(root, elbow, 0.03, PAL.steelDark, 6);
	r.box(root[0] - 0.06, root[1], root[2] - 0.08, 0.12, 0.02, 0.16, PAL.steelDark);
	r.orientedBox(x - n[0] * 0.03, y - n[1] * 0.03, z - 0.17, 0.05, 0.48, 0.34, a, "#3a3f47");
	const at = (s, zz, out = 0.001) => [x + tg[0] * s + n[0] * out, y + tg[1] * s + n[1] * out, zz];
	r.quad([at(-0.2, z - 0.14), at(0.2, z - 0.14), at(0.2, z + 0.14), at(-0.2, z + 0.14)], PAL.screen, { flat: true });
	// Robot status tiles (six robots), a line-status bar, and a trend line. No text.
	r.quad([at(-0.18, z + 0.08, 0.002), at(0.18, z + 0.08, 0.002), at(0.18, z + 0.12, 0.002), at(-0.18, z + 0.12, 0.002)], "#2e9e5b", { flat: true });
	for (let i = 0; i < 6; i++) {
		const s = -0.17 + (i % 3) * 0.075;
		const zz = z - 0.02 + (i < 3 ? 0.05 : -0.01);
		r.quad([at(s, zz, 0.002), at(s + 0.06, zz, 0.002), at(s + 0.06, zz + 0.045, 0.002), at(s, zz + 0.045, 0.002)], PAL.screenOn, { flat: true });
	}
	r.polyline([at(0.06, z - 0.1, 0.003), at(0.09, z - 0.06, 0.003), at(0.12, z - 0.08, 0.003), at(0.15, z - 0.02, 0.003), at(0.18, z - 0.04, 0.003)], "#7fc4ff", 1.1);
}

function drawCabinet(r) {
	const { x0, x1, y0 } = CABINET;
	const d = x1 - x0;
	r.ground(x1, y0 - 0.05, 0.12, CABINET.y1 - y0 + 0.1, "rgba(60,50,40,0.18)", 0.006);
	r.box(x0 + 0.04, y0, 0, d - 0.06, CABINET.y1 - y0, 0.1, PLINTH);
	// Riser posts under the roof tray (between the cabinet top and the tray).
	let y = y0;
	for (const sec of SECTIONS) {
		r.box(x0, y, 0.1, d, sec.w, sec.h - 0.1, PAINT, { top: "#e3e6e2" });
		door(r, x1, y, y + sec.w, sec.h, sec);
		// Cables up from each section to the roof tray.
		r.box(x0 + 0.17, y + sec.w / 2 - 0.04, sec.h, 0.08, 0.08, TRAY_Z - sec.h, "#2f343b");
		y += sec.w;
	}
	// Heater / cooling unit on the roof over the apple arm controllers.
	const cy0 = y0 + 0.9 + 0.7 + 0.1;
	r.box(x0 + 0.45, cy0, 2.0, 0.5, 1.4, 0.36, "#c4cacf", { top: "#d3d8dc" });
	r.cylinder(x0 + 0.7, cy0 + 0.45, 2.36, 0.17, 0.015, "#5d656e", 10);
	r.cylinder(x0 + 0.7, cy0 + 0.95, 2.36, 0.17, 0.015, "#5d656e", 10);
	for (let k = 0; k < 4; k++) r.line([x0 + 0.954, cy0 + 0.15, 2.08 + k * 0.07], [x0 + 0.954, cy0 + 1.25, 2.08 + k * 0.07], "#8d959d", 1);
	r.sphere(x0 + 0.955, cy0 + 1.3, 2.3, 0.025, "#e8792f", 0, { flat: true });
	// Roof cable tray along the bank, then toward the wall.
	trayRun(r, [x0 + 0.22, y0 + 0.15, TRAY_Z], [x0 + 0.22, CABINET.y1 - 0.15, TRAY_Z], GALV);
	trayRun(r, [x0 + 0.05, TRAY_Y, TRAY_Z], [21.0, TRAY_Y, TRAY_Z], GALV);
	// Stack light on the PLC section: green lit (running), amber and red off.
	const sx = x1 - 0.2;
	const sy = CABINET.y1 - 0.2;
	r.cylinder(sx, sy, 2.0, 0.04, 0.08, PAL.dark, 8);
	r.cylinder(sx, sy, 2.08, 0.055, 0.09, LAMP.green, 10, { flat: true });
	r.cylinder(sx, sy, 2.17, 0.055, 0.09, LAMP.amber, 10);
	r.cylinder(sx, sy, 2.26, 0.055, 0.09, LAMP.red, 10);
	r.cylinder(sx, sy, 2.35, 0.045, 0.03, PAL.dark, 8);
	drawHmi(r);
}

/** Where the tray passes through the cold room wall: a sealed sleeve and a hint of the cut-away wall. */
function drawWallPass(r) {
	r.box(21.0, TRAY_Y - 0.6, 0.6, 0.3, 1.2, 2.3, PAL.wall, { alpha: 0.28 });
	r.box(20.96, TRAY_Y - TRAY_W / 2 - 0.06, TRAY_Z - 0.08, 0.38, TRAY_W + 0.12, 0.24, PAL.steelDark, { top: "#a1aab3" });
}

export function buildCabinet(scene, ctx) {
	const g = { group: ctx.group };
	object(scene, 20.9, CABINET.y0 - 0.1, CABINET.x1 + 0.6, CABINET.y1 + 0.7, 2.6, drawCabinet, g);
	object(scene, 20.9, TRAY_Y - 0.6, 21.4, TRAY_Y + 0.6, 2.9, drawWallPass, g);
	// In the cold room: up from the wall, overhead toward the line (stainless, hung from the roof),
	// down beside the front guard to a junction box. Live so it sorts against the ride cart.
	const live = { ...g, live: true };
	const rise = 20.45;
	object(scene, rise - 0.15, TRAY_Y - 0.2, 20.96, TRAY_Y + 0.2, HIGH_Z + 0.1, (r) => {
		trayRun(r, [20.95, TRAY_Y, TRAY_Z], [rise, TRAY_Y, TRAY_Z], PAL.steel);
		trayRun(r, [rise - 0.05, TRAY_Y, TRAY_Z], [rise - 0.05, TRAY_Y, HIGH_Z + 0.08], PAL.steel);
	}, live);
	for (let x = rise; x > DROP_X + 0.01; x -= 2) {
		const xa = Math.max(DROP_X, x - 2);
		object(scene, xa, TRAY_Y - 0.2, x, TRAY_Y + 0.2, HIGH_Z + 0.8, (r) => {
			trayRun(r, [x, TRAY_Y, HIGH_Z], [xa, TRAY_Y, HIGH_Z], PAL.steel);
			const hx = (x + xa) / 2;
			for (const s of [-1, 1]) r.line([hx, TRAY_Y + s * 0.15, HIGH_Z + 0.08], [hx, TRAY_Y + s * 0.15, HIGH_Z + 0.75], PAL.steelDark, 1.2);
		}, live);
	}
	object(scene, GUARD.front, TRAY_Y - 0.25, DROP_X + 0.15, TRAY_Y + 0.25, HIGH_Z + 0.1, (r) => {
		trayRun(r, [DROP_X, TRAY_Y, 2.1], [DROP_X, TRAY_Y, HIGH_Z + 0.08], PAL.steel);
		r.box(GUARD.front + 0.05, TRAY_Y - 0.2, 1.62, 0.36, 0.4, 0.48, PAL.steel, { top: "#cfd5db" });
		r.line([GUARD.front + 0.42, TRAY_Y - 0.12, 1.75], [GUARD.front + 0.42, TRAY_Y + 0.12, 1.75], PAL.steelDark, 1);
	}, live);
}
