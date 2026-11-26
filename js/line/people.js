// The people who run the line: Operator 1 (supply aisle), Operator 2 (rework and outfeed), and
// the shared line technician (on call by the controller cabinet). Drawing code only.

import { PAL } from "./common.js";
import { POSTS } from "./layout.js";

/**
 * A low-poly person standing at (x, y), facing angle `facing` (radians, 0 = +x). color: the
 * hi-vis vest / shirt color. pose: { walk: 0..1 phase, reach: 0..1 (arms forward), carry: bool }.
 * Everyone in the cold room wears a white coat, hairnet, and boots.
 */
export function drawPerson(r, x, y, facing, color, pose = {}) {
	const ca = Math.cos(facing);
	const sa = Math.sin(facing);
	const at = (f, sd, z) => [x + f * ca - sd * sa, y + f * sa + sd * ca, z];
	const swing = pose.walk !== undefined ? Math.sin(pose.walk * Math.PI * 2) * 0.12 : 0;
	r.shadow(x, y, 0.32, 0.24, 0.2, 0);
	// Legs and boots.
	for (const [sd, s] of [
		[-0.09, swing],
		[0.09, -swing],
	]) {
		const p = at(s, sd, 0);
		r.box(p[0] - 0.06, p[1] - 0.06, 0, 0.12, 0.12, 0.16, PAL.person.boots);
		r.box(p[0] - 0.055, p[1] - 0.055, 0.16, 0.11, 0.11, 0.62, "#e9ecef");
	}
	// Torso: white coat with a colored vest.
	const c = at(0, 0, 0);
	r.cylinder(c[0], c[1], 0.76, 0.19, 0.58, PAL.person.coat, 8);
	r.cylinder(c[0], c[1], 0.9, 0.2, 0.36, color, 8);
	// Arms (forward when reaching or carrying).
	const reach = pose.carry ? 0.8 : (pose.reach ?? 0);
	for (const sd of [-0.24, 0.24]) {
		const sh = at(0, sd, 1.3);
		const hand = at(0.08 + reach * 0.34, sd * (1 - reach * 0.25), 1.3 - 0.5 + reach * 0.32);
		r.tube(sh, hand, 0.05, PAL.person.coat, 6);
		r.sphere(hand[0], hand[1], hand[2], 0.05, PAL.person.skin, 0);
	}
	if (pose.carry) {
		const box = at(0.42, 0, 1.05);
		r.box(box[0] - 0.18, box[1] - 0.18, box[2] - 0.08, 0.36, 0.36, 0.16, pose.carryColor ?? "#c9ae80");
	}
	// Head, hairnet.
	r.sphere(c[0], c[1], 1.52, 0.14, PAL.person.skin, 1);
	r.sphere(c[0], c[1], 1.6, 0.13, "#f6f7f8", 1, { sz: 0.6 });
}

const COLORS = { "operator-1": PAL.person.op1, "operator-2": PAL.person.op2, technician: PAL.person.tech };
const FACING = { "operator-1": 0, "operator-2": Math.PI, technician: Math.PI };

export function buildPeople(scene, ctx) {
	for (const [id, [x, y]] of Object.entries(POSTS)) {
		scene.addDynamic({
			group: ctx.group,
			depth: x + y,
			bounds: [x - 0.4, y - 0.4, 0, x + 0.4, y + 0.4, 1.8],
			draw: (r) => drawPerson(r, x, y, FACING[id], COLORS[id]),
		});
		ctx.personTarget(id, [x - 0.4, y - 0.4, 0, x + 0.4, y + 0.4, 1.8], [x, y, 2.0]);
	}
}
