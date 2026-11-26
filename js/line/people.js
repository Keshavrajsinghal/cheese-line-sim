// The people who run the line: Operator 1 (supply aisle), Operator 2 (rework and outfeed), and
// the shared line technician (on call by the controller cabinet), plus the cabinet itself.
// Poses come from people-pose.js (built on the schedules in schedule.js); carried items from
// people-carry.js; the cabinet from people-cabinet.js. Drawing code only; no text.

import { depthOf } from "../engine/iso.js";
import { PAL } from "./common.js";
import { buildCabinet } from "./people-cabinet.js";
import { drawCarriedPlate, drawCarry, SIZE } from "./people-carry.js";
import { itemToBody, POSE } from "./people-pose.js";

const CLOTH = { trousers: "#e3e7eb", glove: "#4f9fe0", net: "#eef2f6", stripe: "#eef4f6", collar: "#f8f9fa" };
const SCANNER = "#2b2f36";
const HIP_Z = 0.88;
const PIVOT = 0.95; // the torso leans about the waist
const SHOULDER = { f: -0.01, sd: 0.2, z: 1.36 };
const ARM = [0.31, 0.3];
const LEG = [0.42, 0.41];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/** Two-bone reach from a toward b; the joint bends toward `pole`. Returns [joint, end]. */
function ik(a, b, l1, l2, pole) {
	let d = sub(b, a);
	let dist = len(d) || 1e-6;
	const max = (l1 + l2) * 0.995;
	let end = b;
	if (dist > max) {
		end = add(a, d, max / dist);
		d = sub(end, a);
		dist = max;
	}
	const u = [d[0] / dist, d[1] / dist, d[2] / dist];
	const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
	const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
	let p = add(pole, u, -dot(pole, u));
	const pl = len(p) || 1;
	p = [p[0] / pl, p[1] / pl, p[2] / pl];
	return [add(add(a, u, x), p, h), end];
}

/** Legacy pose (walk phase, reach, carry flag) to feet and hand targets. */
function legacyLimbs(pose) {
	const ph = pose.walk;
	const a = (ph ?? 0) * Math.PI * 2;
	const sw = ph === undefined ? 0 : Math.sin(a);
	const feet = [
		[0.03 + 0.27 * sw, 0.1, ph === undefined ? 0 : 0.07 * Math.max(0, Math.cos(a))],
		[0.03 - 0.27 * sw, -0.1, ph === undefined ? 0 : 0.07 * Math.max(0, -Math.cos(a))],
	];
	const reach = pose.carry ? 0.8 : (pose.reach ?? 0);
	const hands = [1, -1].map((s) => [0.03 + reach * 0.4 - s * 0.17 * sw, s * 0.25 * (1 - reach * 0.3), 0.8 + reach * 0.3]);
	return { feet, hands };
}

/**
 * A low-poly person standing at (x, y), facing angle `facing` (radians, 0 = +x), in cold-room
 * whites (coat, trousers, hairnet, boots, blue gloves) with a hi-vis vest in `color`.
 * pose (all optional, body frame: f forward, sd to the left, z up):
 *   feet [[f, sd, lift] x2], hands [[f, sd, z] | null x2] (left, right), lean (radians forward),
 *   bob (body rise), head (yaw), item { kind, f, sd, z, pitch, yaw, ... } (see people-carry.js),
 *   scan { to } (right hand holds a barcode scanner aimed at `to`), holster (scanner on the hip),
 *   walk (walk-cycle phase, used when feet/hands are not given), reach (0..1), carry (bool).
 */
export function drawPerson(r, x, y, facing, color, pose = {}) {
	const c = Math.cos(facing);
	const n = Math.sin(facing);
	const at = (f, sd, z) => [x + f * c - sd * n, y + f * n + sd * c, z];
	const lean = pose.lean ?? 0;
	const cl = Math.cos(lean);
	const sl = Math.sin(lean);
	const bob = pose.bob ?? 0;
	/** Upper body point, rotated forward about the waist by the lean. */
	const up = (f, sd, z) => {
		const dz = z - PIVOT;
		return at(f * cl + dz * sl, sd, PIVOT - f * sl + dz * cl + bob);
	};
	const low = (f, sd, z) => at(f, sd, z + bob);
	const far = r.zoom < 0.5;
	const segs = far ? 6 : 8;
	const ring = (z, rf, rs, fn) => Array.from({ length: segs }, (_, i) => fn(rf * Math.cos((i / segs) * Math.PI * 2), rs * Math.sin((i / segs) * Math.PI * 2), z));
	const frustum = (A, B, col, cap = true) => {
		const faces = [];
		for (let i = 0; i < A.length; i++) {
			const j = (i + 1) % A.length;
			faces.push([A[i], A[j], B[j], B[i]]);
		}
		if (cap) faces.push(B);
		const mid = [0, 0, 0];
		for (const p of [...A, ...B]) for (let k = 0; k < 3; k++) mid[k] += p[k] / (A.length + B.length);
		r.mesh(faces, col, { center: mid });
	};
	const fwd = [c, n, 0];
	const left = [-n, c, 0];
	const limbs = pose.feet && pose.hands ? pose : legacyLimbs(pose);

	r.shadow(x, y, 0.34, 0.26, 0.2, 0);

	// Legs: white trousers into boots, nearest leg last (the coat covers the thighs).
	const legs = limbs.feet.map(([ff, fsd, lift], i) => {
		const hip = at(0, (i === 0 ? 1 : -1) * 0.09, HIP_Z + bob);
		const ankle = at(ff, fsd, 0.1 + lift);
		const [knee] = ik(hip, ankle, LEG[0], LEG[1], fwd);
		return { d: depthOf(ankle[0], ankle[1], 0), hip, knee, ankle, ff, fsd, lift };
	});
	legs.sort((a, b) => a.d - b.d);
	for (const L of legs) {
		r.tube(mix(L.hip, L.knee, 0.4), L.knee, 0.068, CLOTH.trousers, 6);
		r.tube(L.knee, L.ankle, 0.062, CLOTH.trousers, 6);
		const toe = at(L.ff + 0.05, L.fsd, L.lift);
		r.orientedBox(toe[0], toe[1], L.lift, 0.27, 0.12, 0.11, facing, PAL.person.boots);
		r.tube([L.ankle[0], L.ankle[1], L.lift + 0.06], mix(L.ankle, L.knee, 0.4), 0.07, PAL.person.boots, 6);
	}

	// Upper body parts, depth sorted: coat and vest, head and hairnet, arms, the carried item.
	const parts = [];
	parts.push({
		d: depthOf(...up(0, 0, 1.1)),
		fn: () => {
			frustum(ring(0.58, 0.155, 0.205, at), ring(PIVOT, 0.13, 0.185, low), PAL.person.coat, false);
			frustum(ring(PIVOT, 0.136, 0.19, up), ring(1.32, 0.13, 0.215, up), color, false);
			frustum(ring(1.32, 0.13, 0.215, up), ring(1.43, 0.075, 0.12, up), color);
			if (r.zoom >= 0.9) frustum(ring(1.05, 0.143, 0.206, up), ring(1.09, 0.143, 0.208, up), CLOTH.stripe, false);
			frustum(ring(1.405, 0.07, 0.09, up), ring(1.46, 0.06, 0.075, up), CLOTH.collar);
		},
	});
	const hy = pose.head ?? 0;
	const head = up(0.015, 0, 1.585);
	parts.push({
		d: depthOf(...head),
		fn: () => {
			r.sphere(head[0], head[1], head[2], 0.112, PAL.person.skin, far ? 0 : 1);
			const net = up(0.015 - 0.035 * Math.cos(hy), -0.035 * Math.sin(hy), 1.632);
			r.sphere(net[0], net[1], net[2], 0.118, CLOTH.net, far ? 0 : 1, { sz: 0.78 });
		},
	});
	for (let i = 0; i < 2; i++) {
		const h = limbs.hands[i];
		if (!h) continue;
		const side = i === 0 ? 1 : -1;
		const sh = up(SHOULDER.f, side * SHOULDER.sd, SHOULDER.z);
		// Elbows bend down, out, and a little back.
		const pole = [-0.25 * fwd[0] + 0.45 * side * left[0], -0.25 * fwd[1] + 0.45 * side * left[1], -1];
		const [elbow, wrist] = ik(sh, at(h[0], h[1], h[2]), ARM[0], ARM[1], pole);
		const cuff = mix(elbow, wrist, 0.74);
		parts.push({
			d: depthOf(...mix(elbow, wrist, 0.5)) + 0.05,
			fn: () => {
				r.tube(sh, elbow, 0.058, PAL.person.coat, 6);
				r.tube(elbow, cuff, 0.052, PAL.person.coat, 6);
				r.tube(cuff, wrist, 0.047, CLOTH.glove, 5);
				r.sphere(wrist[0], wrist[1], wrist[2], 0.054, CLOTH.glove, 0);
				if (i === 1 && pose.scan) {
					// Handheld barcode scanner and its beam on the stack's label.
					r.orientedBox(wrist[0], wrist[1], wrist[2] - 0.02, 0.13, 0.05, 0.07, facing - Math.PI / 2, SCANNER);
					r.line(add(wrist, [0, 0, 0.02]), at(...pose.scan.to), "#ff3b30", 1.4);
				}
			},
		});
	}
	if (pose.holster && !pose.scan) {
		const hip = up(0.02, -0.2, 0.98);
		parts.push({ d: depthOf(...hip) + 0.02, fn: () => r.orientedBox(hip[0], hip[1], hip[2] - 0.06, 0.07, 0.05, 0.13, facing, SCANNER) });
	}
	const it = pose.item;
	if (it) {
		const sz = SIZE[it.kind] ?? SIZE.trays;
		const toWorld = (u, v, w) => {
			const b = itemToBody(it, u, v, w);
			return at(b[0], b[1], b[2]);
		};
		parts.push({
			d: depthOf(...toWorld(0, 0, sz.h / 2)),
			fn: () => {
				if (it.kind === "plate") {
					const o = toWorld(0, 0, 0);
					drawCarriedPlate(r, o[0], o[1], o[2], facing - Math.PI / 2 + (it.yaw ?? 0), it.table);
				} else drawCarry(r, toWorld, it.kind, it);
			},
		});
	}
	parts.sort((a, b) => a.d - b.d);
	for (const p of parts) p.fn();
}

const COLORS = { "operator-1": PAL.person.op1, "operator-2": PAL.person.op2, technician: PAL.person.tech };

function drawSpec(r, id, s) {
	// A plate Operator 2 has just let go of at the re-entry chute sits behind them.
	if (s.slide) drawCarriedPlate(r, s.slide.x, s.slide.y, s.slide.z, Math.PI / 2, s.slide.table);
	drawPerson(r, s.x, s.y, s.facing, COLORS[id], s);
}

/**
 * The three people and the controller cabinet. Each person is one dynamic item whose position,
 * depth, bounds, hit area, and label follow their schedule (in line time T(t)).
 */
export function buildPeople(scene, ctx, T = (t) => t) {
	buildCabinet(scene, ctx);
	for (const id of Object.keys(COLORS)) {
		const poseAt = POSE[id];
		let memoT = Number.NaN;
		let memo = null;
		const pose = (t = scene.time) => {
			const lt = T(t);
			if (lt !== memoT) {
				memoT = lt;
				memo = poseAt(lt);
			}
			return memo;
		};
		const bounds = () => {
			const s = pose();
			return [s.x - 0.45, s.y - 0.45, 0, s.x + 0.45, s.y + 0.45, 1.85];
		};
		scene.addDynamic({
			group: ctx.group,
			depth: () => {
				const s = pose();
				return s.x + s.y;
			},
			bounds,
			animated: () => true,
			draw: (r, t) => drawSpec(r, id, pose(t)),
		});
		ctx.personTarget(id, bounds, () => {
			const s = pose();
			return [s.x, s.y, 2.05];
		});
	}
}
