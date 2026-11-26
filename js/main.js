// Boot: load content, build the plant scene and the UI, wire the router, expose window.__rt for
// tests. One ride (the tray), plus info views (stations, people, places, sections) in the panel.

import { $, h, isMissingModule } from "./core/dom.js";
import { bus } from "./core/events.js";
import { Router } from "./core/router.js";
import { reducedMotion, state } from "./core/state.js";
import { drawCart } from "./engine/cart.js";
import { RideRunner, SPEEDS } from "./engine/ride-runner.js";
import { Scene } from "./engine/scene.js";
import { Track } from "./engine/track.js";
import { PAL } from "./line/common.js";
import { LANES, LIMITS, REENTRY } from "./line/layout.js";
import { buildPlant } from "./line/plant.js";
import rideModule from "./line/ride.js";
import { initControls } from "./ui/controls.js";
import { initHud } from "./ui/hud.js";
import { closeModals, modalOpen, topModal } from "./ui/modal.js";
import { initPanel } from "./ui/panel.js";
import { initRoute } from "./ui/route.js";

const RIDE_ID = "line";
const boot = $("#boot");

function bootMessage(title, ...lines) {
	boot.replaceChildren(h("div", { class: "boot-card" }, h("h1", {}, title), ...lines.map((l) => h("p", {}, l))));
	boot.hidden = false;
}

async function loadContent() {
	try {
		const mod = await import("./content.js");
		return mod.CONTENT ?? null;
	} catch (e) {
		if (!isMissingModule(e)) console.error(e);
		return null;
	}
}

async function main() {
	const content = await loadContent();
	if (!content) {
		bootMessage("Content is not built yet", "The site could not load js/content.js, which holds every word it shows.", "Generate it with: node tools/build-content.mjs");
		return;
	}
	document.title = content.meta.title;
	const ride = content.ride;
	const track = new Track(rideModule.trackFor("classical"));
	const missing = ride.stops.filter((s) => track.stopS[s.id] === undefined);
	if (missing.length) throw new Error(`track has no point for stop(s) ${missing.map((s) => s.id).join(", ")}`);

	const canvas = $("#park-canvas");
	const scene = new Scene({ canvas, overlay: $("#park-overlay"), background: PAL.bg, limits: LIMITS, minZoom: 0.3, maxZoom: 3.2 });
	scene.reducedMotion = reducedMotion;
	const rideInfo = { id: RIDE_ID, ride, module: rideModule, available: true, color: PAL.track };
	const app = {
		content,
		state,
		bus,
		scene,
		rides: new Map([[RIDE_ID, rideInfo]]),
		rideList: [rideInfo],
		ride: rideInfo,
		currentRideId: null,
		viewName: "park",
		viewKind: "overview",
		reducedMotion,
		isPhone: () => window.matchMedia("(max-width: 759px)").matches,
		hudHeight: () => $("#hud").offsetHeight,
		focusPoints: new Map(), // "kind:id" -> [x, y, z] (or a function returning one)
	};
	const sheetExpanded = () => app.isPhone() && !$("#panel").hidden && $("#panel").dataset.state === "expanded";
	const keyboardInPanel = () => {
		const a = document.activeElement;
		return !!a && $("#panel-body").contains(a) && a.matches(":focus-visible");
	};
	const runner = new RideRunner({ reducedMotion, holdDwell: () => (app.panel?.isHovered() ?? false) || keyboardInPanel() || sheetExpanded() || modalOpen() });
	runner.setSpeed(SPEEDS.includes(state.get("speed")) ? state.get("speed") : 1);
	app.runner = runner;
	const router = new Router((route, prev) => onRoute(route, prev));
	app.router = router;

	app.seenCount = () => {
		let seen = 0;
		for (const s of ride.stops) if (state.isSeen(RIDE_ID, s.id)) seen++;
		return { seen, total: ride.stops.length };
	};

	// ---------------------------------------------------------------- ride context
	const go = (route) => router.go(route);
	const ctx = {
		rideId: RIDE_ID,
		ride,
		content,
		group: RIDE_ID,
		pal: PAL,
		mode: "classical",
		get stops() {
			return ride.stops;
		},
		reducedMotion,
		isActive: () => app.currentRideId === RIDE_ID,
		currentStopId: () => (app.currentRideId === RIDE_ID ? (runner.stop?.id ?? null) : null),
		stopTitle: (id) => ride.stops.find((s) => s.id === id)?.title ?? "",
		goToStop: (id) => goToStop(id),
		label: (opts) => scene.addLabel({ kind: "station", group: RIDE_ID, ...opts }),
		/** A ride stop on the map: label plus hit area; clicking rides there. */
		stopTarget(stopId, bounds, labelPos) {
			const stop = ride.stops.find((s) => s.id === stopId);
			if (!stop) return;
			const goThere = () => goToStop(stopId);
			app.focusPoints.set(`stop:${stopId}`, labelPos);
			scene.addHit({ id: `stop-${stopId}`, kind: "stop", group: RIDE_ID, bounds, priority: 1, onActivate: goThere });
			scene.addLabel({ id: `stop-${RIDE_ID}-${stopId}`, group: RIDE_ID, kind: "station", pos: labelPos, text: stop.title, onClick: goThere, ariaLabel: `Stop: ${stop.title}` });
		},
		/** Something on the map that is not a stop (aisle, rework table, cabinet): opens its panel. */
		placeTarget(placeId, bounds, labelPos, opts = {}) {
			const place = content.places[placeId];
			if (!place) return;
			const open = () => go({ name: "place", id: placeId });
			app.focusPoints.set(`place:${placeId}`, labelPos);
			if (bounds) scene.addHit({ id: `place-${placeId}`, kind: "place", group: RIDE_ID, bounds, priority: 2, onActivate: open });
			scene.addLabel({ id: `place-${placeId}`, group: RIDE_ID, kind: opts.kind ?? "sign", pos: labelPos, text: opts.text ?? place.title, onClick: open, ariaLabel: place.title });
		},
		/** A person: labelPos may be a function (they walk). Clicking opens their role and workload. */
		personTarget(personId, boundsFn, labelPos) {
			const person = content.people.find((p) => p.id === personId);
			if (!person) return;
			const open = () => go({ name: "person", id: personId });
			app.focusPoints.set(`person:${personId}`, labelPos);
			scene.addHit({ id: `person-${personId}`, kind: "person", group: RIDE_ID, bounds: boundsFn, priority: 4, onActivate: open });
			scene.addLabel({ id: `person-${personId}`, group: RIDE_ID, kind: "person", className: `person-${personId}`, pos: labelPos, text: person.title, onClick: open, ariaLabel: `${person.title}: ${person.role}` });
		},
		/** Register where the camera should look for a station's full design section. */
		stationFocus: (id, pos) => app.focusPoints.set(`station:${id}`, pos),
	};
	app.rideCtx = () => ctx;

	// ---------------------------------------------------------------- scene
	let cargoFailed = false;
	function rebuild() {
		scene.clear();
		app.focusPoints.clear();
		buildPlant(scene);
		// No track supports over the reject lanes, the re-entry chutes, or the outfeed (carts roll out
		// under the track there, and Operator 2 works beneath it).
		const clear = [...LANES.map((l) => l.y), ...Object.values(REENTRY).map((r) => r.y)];
		const skipColumn = (p) => p[1] > 43.0 || clear.some((y) => Math.abs(p[1] - y) < 0.9);
		track.draw(scene, { group: RIDE_ID, spine: "#c9cfd6", column: "#9aa5b1", rail: "#c0442a", railHi: "#f08a6c", tie: "#6f7b87", skipColumn });
		try {
			rideModule.buildScenery(scene, ctx);
		} catch (e) {
			console.error("scenery failed", e);
		}
		scene.addDynamic({
			group: "cart",
			depth: () => {
				const p = runner.pos();
				return p ? p.x + p.y + 0.6 : -1e9;
			},
			bounds: () => {
				const p = runner.pos();
				return p ? [p.x - 1.6, p.y - 1.6, p.z, p.x + 1.6, p.y + 1.6, p.z + 2.4] : [0, 0, 0, 0, 0, 0];
			},
			draw: (r, t) => {
				if (!runner.loaded) return;
				const p = runner.pos();
				const anchor = drawCart(r, p, PAL.track);
				try {
					rideModule.drawCargo(r, runner.stop?.id ?? null, { ...p, anchor }, t, ctx);
				} catch (e) {
					if (!cargoFailed) console.error(e);
					cargoFailed = true;
				}
			},
		});
		scene.addLabel({
			id: "cart-tag",
			kind: "cart",
			pos: () => {
				const p = runner.loaded ? runner.pos() : null;
				return p ? [p.x, p.y, p.z + 2.0] : null;
			},
			html: '<span class="cargo"></span><span class="cargo-detail"></span>',
		});
		scene.setLabelsVisible(!!state.get("labels"));
		updateCartTag();
		updateStationHighlight();
	}

	function updateCartTag() {
		const l = scene.labels.get("cart-tag");
		if (!l) return;
		const stop = runner.loaded ? runner.stop : null;
		l.el.querySelector(".cargo").textContent = stop?.cargo ?? "";
		const d = l.el.querySelector(".cargo-detail");
		d.textContent = stop?.cargoDetail ?? "";
		d.hidden = !stop?.cargoDetail;
		l.el.dataset.stop = stop?.id ?? "";
	}

	function updateStationHighlight() {
		const cur = runner.loaded && !runner.finished ? `stop-${RIDE_ID}-${runner.stop?.id}` : null;
		for (const l of scene.labels.values()) if (l.kind === "station") l.el.classList.toggle("current", l.id === cur);
	}

	function cameraTarget() {
		const p = runner.loaded ? runner.pos() : null;
		if (!p) return null;
		return rideModule.focus ? rideModule.focus(p, ctx) : [p.x, p.y, p.z + 0.6];
	}

	function applyFollow() {
		scene.follow = state.get("follow") && runner.loaded && app.viewKind === "ride" ? cameraTarget : null;
		scene.requestFrame();
	}

	scene.addTick((dt) => runner.update(dt));

	// Labels that would sit on the cart's tag step aside while riding (the current stop's stays);
	// labels under the top bar hang below their point or hide.
	const GUARDED = new Set(["station", "sign", "person"]);
	const phoneMq = window.matchMedia("(max-width: 759px)");
	scene.afterLabels = () => {
		const tag = scene.labels.get("cart-tag");
		const top = scene.insets.top;
		const sheetTop = phoneMq.matches && scene.insets.bottom > 0 ? scene.h - scene.insets.bottom : Infinity;
		let box = null;
		if (runner.loaded && tag && !tag.anchor.hidden && tag.sx !== undefined) {
			const p = runner.pos();
			const cartY = scene.worldToScreen(p.x, p.y, p.z)[1];
			const w = tag.el.offsetWidth;
			const hh = tag.el.offsetHeight;
			if (w) box = [tag.sx - w / 2 - 4, tag.sy - hh - 12, tag.sx + w / 2 + 4, Math.max(tag.sy, cartY + 6)];
		}
		const cur = runner.loaded && !runner.finished ? `stop-${RIDE_ID}-${runner.stop?.id}` : null;
		const checks = [];
		for (const l of scene.labels.values()) {
			if (!GUARDED.has(l.kind) || l.sx === undefined) continue;
			const nearTag = box && !l.anchor.hidden && l.id !== cur && Math.abs(l.sx - tag.sx) < 420 && l.sy > box[1] - 10 && l.sy < box[3] + 90;
			const nearTop = !l.anchor.hidden && l.sy < top + 70;
			const nearSheet = !l.anchor.hidden && l.id !== cur && l.sy > sheetTop + 2 && l.sy < sheetTop + 70;
			const read = nearTag || nearTop || nearSheet;
			checks.push({ l, nearTag, nearTop, nearSheet, w: read ? l.el.offsetWidth : 0, h: read ? l.el.offsetHeight : 0 });
		}
		for (const { l, nearTag, nearTop, nearSheet, w, h: lh } of checks) {
			const below = nearTop && lh > 0 && l.sy - lh < top + 2;
			const y0 = below ? l.sy : l.sy - lh;
			const underBar = below && y0 < top - 2 && l.id !== cur;
			const onTag = nearTag && w > 0 && l.sx - w / 2 < box[2] && l.sx + w / 2 > box[0] && y0 < box[3] && y0 + lh > box[1];
			const peeks = nearSheet && lh > 0 && l.sy - lh < sheetTop;
			const hide = underBar || onTag || peeks;
			const shift = below && l.id === cur && y0 < top + 2 ? `${Math.round(top + 2 - y0)}px` : "";
			if (l.el.style.top !== shift) l.el.style.top = shift;
			l.el.classList.toggle("label-below", below);
			l.el.classList.toggle("label-yield", hide);
		}
	};
	scene.onUserPan = (kind) => {
		if (kind === "zoom" || !state.get("follow") || !runner.loaded || app.viewKind !== "ride") return;
		state.set("follow", false);
		toast("Follow camera off. Turn it back on from the top bar.");
	};

	// ---------------------------------------------------------------- UI
	app.layoutChanged = () => requestAnimationFrame(syncLayout);
	let toastTimer = 0;
	function toast(msg) {
		const el = $("#toast");
		el.textContent = msg;
		el.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
	}
	app.toast = toast;
	app.route = initRoute(app);
	app.hud = initHud(app);
	app.panel = initPanel(app);
	app.controls = initControls(app);

	function syncLayout() {
		const hudEl = $("#hud");
		const hudH = hudEl.offsetHeight;
		document.documentElement.style.setProperty("--hud-px", `${hudH}px`);
		const phone = app.isPhone();
		const panelEl = $("#panel");
		const controlsEl = $("#controls");
		const panelOn = !panelEl.hidden;
		const controlsOn = !controlsEl.hidden;
		const root = $("#app");
		root.classList.toggle("panel-open", panelOn && !phone);
		root.classList.toggle("controls-on", controlsOn);
		const drawer = $("#route-drawer");
		scene.setInsets({
			top: hudH,
			right: panelOn && !phone ? panelEl.offsetWidth : 0,
			bottom: phone ? (panelOn ? panelEl.offsetHeight : 0) + (controlsOn ? controlsEl.offsetHeight : 0) : controlsOn ? 84 : 0,
			left: !drawer.hidden && !phone ? drawer.offsetWidth : 0,
		});
	}
	const ro = new ResizeObserver(() => syncLayout());
	for (const sel of ["#hud", "#panel", "#controls", "#route-drawer"]) ro.observe($(sel));
	window.addEventListener("resize", () => app.layoutChanged());

	/** The whole room in view: the line from the denester to dispatch, both aisles, the corridor. */
	function overviewCamera(instant) {
		scene.fitWorldRect([1, 1, 21, 55], { instant, pad: app.isPhone() ? 1.15 : 1.0, height: 1.2 });
	}

	function selectRide(stopId = null, jump = false) {
		app.viewKind = "ride";
		if (app.currentRideId !== RIDE_ID || !runner.loaded) {
			app.route.close(false);
			app.currentRideId = RIDE_ID;
			runner.load(ride, rideModule, "classical", stopId);
			applyFollow();
			const [fx, fy, fz] = cameraTarget();
			scene.lookAt(fx, fy, fz, { zoom: app.isPhone() ? 1.05 : 1.3 });
		} else {
			applyFollow();
			if (stopId && (runner.stop?.id !== stopId || runner.finished)) runner.goToStopId(stopId, { jump });
			else if (runner.finished) app.panel.showFinish();
			else app.panel.showStop(runner.index);
		}
		app.hud.update();
		app.controls.update();
	}

	function leaveRide() {
		runner.unload();
		app.currentRideId = null;
		app.route.close(false);
		scene.follow = null;
		updateCartTag();
		updateStationHighlight();
		app.controls.update();
		app.hud.update();
	}

	function goToStop(stopId) {
		if (app.currentRideId === RIDE_ID && runner.loaded && app.viewKind === "ride") {
			if (!runner.goToStopId(stopId)) toast("That stop is not on this route.");
		} else router.go({ name: "ride", rideId: RIDE_ID, stopId });
	}

	/** Point the camera at a person, place, or station shown in the panel. */
	function lookAtThing(kind, id) {
		const p = app.focusPoints.get(`${kind}:${id}`);
		const at = typeof p === "function" ? p() : p;
		if (!at) return;
		scene.follow = null;
		scene.lookAt(at[0], at[1], 0, { zoom: app.isPhone() ? 0.9 : 1.1 });
	}

	runner.on("stop", (i, stop) => {
		state.markSeen(RIDE_ID, stop.id);
		if (app.viewKind === "ride") {
			app.panel.showStop(i);
			router.replaceSilently({ name: "ride", rideId: RIDE_ID, stopId: stop.id });
		}
		updateCartTag();
		updateStationHighlight();
		if (app.route.isOpen()) app.route.render();
		app.hud.update();
	});
	runner.on("finish", () => {
		if (app.viewKind === "ride") {
			app.panel.showFinish();
			router.replaceSilently({ name: "ride", rideId: RIDE_ID });
		}
		updateCartTag();
		updateStationHighlight();
		if (app.route.isOpen()) app.route.render();
	});
	runner.on("state", () => {
		app.controls.update();
		scene.requestFrame();
	});

	bus.on("prefs", (key) => {
		if (key === "follow") applyFollow();
		if (key === "labels") scene.setLabelsVisible(!!state.get("labels"));
		app.hud.update();
	});
	bus.on("motion", (on) => {
		$("#app").classList.toggle("reduce-motion", on);
		if (on && runner.move) runner.finishMove();
		app.hud.update();
		scene.invalidate();
	});
	bus.on("progress", () => {
		app.hud.update();
		if (app.route.isOpen()) app.route.render();
	});
	$("#app").classList.toggle("reduce-motion", reducedMotion());

	// ---------------------------------------------------------------- routing
	function onRoute(route) {
		closeModals("route");
		if (route.name === "ride") {
			if (route.rideId !== RIDE_ID) {
				router.replaceSilently({ name: "park" });
				onRoute({ name: "park" });
				return;
			}
			selectRide(route.stopId, true);
			return;
		}
		if (route.name === "park") {
			app.viewKind = "overview";
			leaveRide();
			app.panel.showWelcome();
			overviewCamera(false);
			return;
		}
		// Info views keep the ride loaded (paused) so "Back to the ride" returns to the same stop.
		const known =
			(route.name === "station" && content.stations[route.id]) ||
			(route.name === "person" && content.people.some((p) => p.id === route.id)) ||
			(route.name === "place" && content.places[route.id]) ||
			(route.name === "section" && content.sections[route.id]);
		if (!known) {
			toast("That page does not exist.");
			router.replaceSilently({ name: "park" });
			onRoute({ name: "park" });
			return;
		}
		runner.pause();
		app.viewKind = route.name;
		scene.follow = null;
		app.panel.showInfo(route.name, route.id);
		if (route.name !== "section") lookAtThing(route.name, route.id);
		app.hud.update();
		app.controls.update();
	}
	app.backToRide = () => router.go({ name: "ride", rideId: RIDE_ID, stopId: runner.loaded ? (runner.stop?.id ?? null) : null });

	// ---------------------------------------------------------------- global input
	document.addEventListener("click", (e) => {
		const a = e.target.closest?.("a.internal-link");
		if (!a) return;
		e.preventDefault();
		location.hash = a.getAttribute("href");
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			const m = topModal();
			if (m) {
				e.preventDefault();
				m.close("escape");
				return;
			}
			if (app.hud.menuOpen()) {
				app.hud.closeMenus(true);
				return;
			}
			if (app.route.isOpen()) {
				app.route.close();
				return;
			}
			if (app.isPhone() && $("#panel").dataset.state === "expanded") app.panel.setExpanded(false);
			return;
		}
		if (modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
		const t = e.target;
		const tag = t?.tagName ?? "";
		if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || t?.isContentEditable) return;
		if (!runner.loaded || app.viewKind !== "ride") return;
		if (e.key === " " || e.code === "Space") {
			if (["BUTTON", "A", "SUMMARY"].includes(tag)) return;
			e.preventDefault();
			runner.toggle();
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			runner.stepForward();
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			runner.stepBack();
		}
	});

	// ---------------------------------------------------------------- start
	rebuild();
	app.panel.showWelcome();
	app.hud.update();
	app.controls.update();
	syncLayout();
	overviewCamera(true);
	boot.hidden = true;
	router.start();
	syncLayout();

	// Test API (used by tests/smoke.mjs). Not a public interface.
	window.__rt = {
		app,
		content,
		state: () => runner.state(),
		view: () => app.viewKind,
		select: (stopId) => router.go({ name: "ride", rideId: RIDE_ID, stopId }),
		play: () => runner.play(),
		pause: () => runner.pause(),
		stepForward: () => runner.stepForward(),
		stepBack: () => runner.stepBack(),
		restart: () => runner.restart(),
		goToStop: (i, jump = false) => runner.goToStop(i, { jump }),
		finishMove: () => runner.finishMove(),
		setSpeed: (x) => runner.setSpeed(x),
		cartScreen: () => {
			const p = runner.pos();
			return p ? scene.worldToScreen(p.x, p.y, p.z) : null;
		},
		camera: () => ({ ...scene.camera, insets: { ...scene.insets } }),
		idle: () => scene.isIdle(),
		reducedMotion: () => reducedMotion(),
		hits: () => scene.hits.map((x) => ({ id: x.id, kind: x.kind })),
		labels: () => [...scene.labels.values()].map((l) => ({ id: l.id, kind: l.kind, text: l.el.textContent })),
		time: () => scene.time,
		ready: true,
	};
	document.documentElement.dataset.ready = "1";
}

main().catch((e) => {
	console.error(e);
	bootMessage("Something went wrong", String(e?.message ?? e));
});
