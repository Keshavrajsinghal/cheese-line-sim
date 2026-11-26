// Side panel (a bottom sheet on phones). Shows the welcome card, the current stop of the tray
// ride, the ride-complete card, or an info view: a station's full design section, a person's role
// and workload, a place on the map, or a document section. Every word of content comes from
// content.js; only UI chrome (button labels, kickers) lives here.

import { $, h } from "../core/dom.js";
import { icon } from "./icons.js";

export function initPanel(app) {
	const el = $("#panel");
	const reopen = $("#panel-reopen");
	const toggle = h("button", { class: "sheet-toggle", type: "button", "aria-expanded": "false", "aria-controls": "panel-body" }, h("span", { class: "grip" }), h("span", { class: "sr-only" }, "Expand or collapse the panel"));
	const kicker = h("div", { class: "panel-kicker" });
	const title = h("h2", { class: "panel-title", id: "panel-title", tabindex: "-1" });
	const cargo = h("div", { class: "cargo-tag", hidden: true });
	const close = h("button", { class: "icon-btn panel-close", type: "button", "aria-label": "Close panel", html: icon("close") });
	const head = h("div", { class: "panel-head" }, toggle, kicker, title, cargo, close);
	const body = h("div", { class: "panel-body", id: "panel-body" });
	el.append(head, body);
	el.setAttribute("aria-labelledby", "panel-title");
	el.dataset.state = "collapsed";

	const C = app.content;
	let view = { type: "welcome" };
	let cleanup = null;
	let hovering = false;
	const detailsOpen = new Map(); // remembers which collapsible sections the reader opened

	el.addEventListener("pointerenter", (e) => {
		if (e.pointerType === "mouse") hovering = true;
	});
	el.addEventListener("pointerleave", () => {
		hovering = false;
	});

	const setExpanded = (v) => {
		el.dataset.state = v ? "expanded" : "collapsed";
		toggle.setAttribute("aria-expanded", v ? "true" : "false");
		app.layoutChanged();
	};
	toggle.addEventListener("click", (e) => {
		e.stopPropagation();
		setExpanded(el.dataset.state !== "expanded");
	});
	head.addEventListener("click", (e) => {
		if (!app.isPhone() || e.target.closest("button, a")) return;
		setExpanded(el.dataset.state !== "expanded");
	});
	close.addEventListener("click", () => hide(true));
	reopen.addEventListener("click", () => show());

	function show() {
		el.hidden = false;
		reopen.hidden = true;
		app.layoutChanged();
	}

	function hide(userClosed) {
		el.hidden = true;
		reopen.hidden = !userClosed;
		app.layoutChanged();
		if (userClosed) reopen.focus({ preventScroll: true });
	}

	function setHead(k, t, cargoText, detail) {
		kicker.textContent = k;
		title.textContent = t;
		cargo.replaceChildren();
		if (cargoText) {
			cargo.append(h("span", { class: "cargo" }, cargoText));
			if (detail) cargo.append(h("span", { class: "cargo-detail" }, detail));
		}
		cargo.hidden = !cargoText;
	}

	const btn = (label, onClick, opts = {}) => {
		const b = h("button", { class: `btn${opts.primary ? " primary" : ""}${opts.block ? " block" : ""}`, type: "button", ...(opts.attrs ?? {}) }, label);
		b.addEventListener("click", onClick);
		return b;
	};
	const go = (route) => app.router.go(route);
	const prose = (html, cls = "") => h("div", { class: `prose ${cls}`.trim(), html });

	/** A collapsible block; open state persists per key while the page is open. */
	function collapsible(key, summary, content, defaultOpen) {
		const d = h("details", { class: "read-more", "data-key": key }, h("summary", {}, summary), h("div", { class: "read-more-body" }, content));
		d.open = detailsOpen.has(key) ? detailsOpen.get(key) : defaultOpen;
		d.addEventListener("toggle", () => detailsOpen.set(key, d.open));
		return d;
	}

	function peopleCards() {
		return h(
			"div",
			{ class: "people-cards" },
			C.people.map((p) =>
				h(
					"button",
					{ class: `person-card person-${p.id}`, type: "button", "data-person": p.id, onclick: () => go({ name: "person", id: p.id }) },
					h("span", { class: "person-dot", "aria-hidden": "true" }),
					h("span", { class: "person-text" }, h("strong", {}, p.title), h("span", {}, p.role)),
				),
			),
		);
	}

	function sectionButtons(ids) {
		return h(
			"div",
			{ class: "btns section-btns" },
			ids.filter((id) => C.sections[id]).map((id) => btn(C.sections[id].title, () => go({ name: "section", id }), { attrs: { "data-section": id } })),
		);
	}

	function renderWelcome() {
		setHead(C.meta.tagline, C.meta.title);
		const start = btn(C.ride.title, () => go({ name: "ride", rideId: C.ride.id }), { primary: true, attrs: { "data-start-ride": C.ride.id } });
		body.append(
			h("p", { class: "lede" }, C.meta.subtitle),
			h("div", { class: "btns" }, start, btn(C.sections.throughput.title, () => go({ name: "section", id: "throughput" }), { attrs: { "data-section": "throughput" } })),
			h("h3", { class: "panel-sub" }, "People"),
			peopleCards(),
			h("h3", { class: "panel-sub" }, "Stations"),
			h(
				"ol",
				{ class: "station-list" },
				C.ride.stops.map((s, i) =>
					h("li", {}, h("button", { class: "linklike", type: "button", "data-stop": s.id, onclick: () => go({ name: "ride", rideId: C.ride.id, stopId: s.id }) }, `${i + 1}. ${s.title}`)),
				),
			),
			collapsible("about", C.sections.about.title, prose(C.sections.about.html), !app.isPhone()),
			h("h3", { class: "panel-sub" }, "More of the design"),
			sectionButtons(["how-to-read", "roster", "shift", "ai-usage"]),
		);
	}

	function renderStop(i) {
		const r = app.runner;
		const stop = r.stops[i];
		if (!stop) return renderWelcome();
		setHead(`${C.ride.title} · Stop ${i + 1} of ${r.stops.length}`, stop.title, stop.cargo, stop.cargoDetail);
		body.dataset.stop = stop.id;
		const parts = [];
		const box = h("div", { class: "closeup" });
		const mod = app.ride.module;
		if (mod.closeup) {
			queueMicrotask(() => {
				if (!box.isConnected) return;
				try {
					cleanup = mod.closeup(stop.id, box, app.rideCtx()) ?? null;
				} catch (e) {
					console.error(e);
					box.remove();
				}
			});
		}
		const here = h("section", { class: "card here-card" }, h("div", { class: "card-kicker" }, "At this stop"), prose(stop.here, "stop-text"));
		// On a phone the collapsed sheet shows only its top, so the explanation comes first.
		if (app.isPhone()) parts.push(here, box);
		else parts.push(box, here);
		const station = C.stations[stop.station];
		// A station with two stops (apples, cheese) opens its full section at the first one only.
		const firstOfStation = r.stops.findIndex((s) => s.station === stop.station) === i;
		if (station) parts.push(collapsible(`station:${stop.station}`, `Station design: ${station.title}`, prose(station.html, "station-text"), firstOfStation && !app.isPhone()));
		parts.push(h("div", { class: "btns" }, btn("People", () => go({ name: "section", id: "roster" })), btn(C.sections.throughput.title, () => go({ name: "section", id: "throughput" }))));
		body.append(...parts);
	}

	function renderFinish() {
		const r = app.runner;
		const last = r.stops[r.stops.length - 1];
		setHead(C.ride.title, "Ride complete", last?.cargo, last?.cargoDetail);
		body.dataset.stop = "finish";
		body.append(
			h(
				"section",
				{ class: "card complete-card", "data-ride-complete": C.ride.id },
				h("div", { class: "card-kicker" }, "Ride complete"),
				h("div", { class: "btns" }, btn("Ride again", () => r.restart(), { primary: true }), btn(C.sections.throughput.title, () => go({ name: "section", id: "throughput" })), btn("Overview", () => go({ name: "park" }))),
			),
			h("h3", { class: "panel-sub" }, "People"),
			peopleCards(),
		);
	}

	function backButtons() {
		const out = [];
		if (app.runner.loaded) out.push(btn("Back to the ride", () => app.backToRide(), { primary: true, attrs: { "data-back-ride": "1" } }));
		out.push(btn("Overview", () => go({ name: "park" })));
		return h("div", { class: "btns" }, out);
	}

	function renderInfo(kind, id) {
		body.dataset.info = `${kind}:${id}`;
		if (kind === "station") {
			const s = C.stations[id];
			setHead("Station design", s.title);
			const stops = C.ride.stops.filter((x) => x.station === id);
			body.append(
				backButtons(),
				stops.length ? h("div", { class: "btns" }, stops.map((x) => btn(`Ride to: ${x.title}`, () => go({ name: "ride", rideId: C.ride.id, stopId: x.id })))) : null,
				prose(s.html, "station-text"),
			);
		} else if (kind === "person") {
			const p = C.people.find((x) => x.id === id);
			setHead(p.role, p.title);
			body.append(
				backButtons(),
				h("dl", { class: "facts" }, h("dt", {}, "Where"), h("dd", {}, p.where)),
				prose(p.html, "person-text"),
				h("h3", { class: "panel-sub" }, "Everyone on the line"),
				peopleCards(),
				sectionButtons(["roster", "shift"]),
			);
		} else if (kind === "place") {
			const p = C.places[id];
			setHead("On the map", p.title);
			body.append(backButtons(), prose(p.html, "place-text"));
		} else if (kind === "section") {
			const s = C.sections[id];
			setHead(C.meta.title, s.title);
			body.append(backButtons(), prose(s.html, "section-text"));
		}
	}

	/** Selector that finds the same control after a re-render ("" when there is none). */
	function focusKey(a) {
		for (const k of ["data-start-ride", "data-section", "data-person", "data-stop", "data-back-ride"]) if (a.hasAttribute(k)) return `[${k}="${CSS.escape(a.getAttribute(k))}"]`;
		const d = a.closest("details[data-key]");
		return d && a.matches("summary") ? `details[data-key="${CSS.escape(d.dataset.key)}"] > summary` : "";
	}

	function render() {
		cleanup?.();
		cleanup = null;
		const keepScroll = body.scrollTop;
		const viewKey = `${view.type}:${view.index ?? ""}:${view.kind ?? ""}:${view.id ?? ""}`;
		const sameView = body.dataset.view === viewKey;
		const active = document.activeElement;
		const key = active && body.contains(active) ? focusKey(active) : null;
		body.replaceChildren();
		delete body.dataset.stop;
		delete body.dataset.info;
		if (view.type === "stop") renderStop(view.index);
		else if (view.type === "finish") renderFinish();
		else if (view.type === "info") renderInfo(view.kind, view.id);
		else renderWelcome();
		body.dataset.view = viewKey;
		body.scrollTop = sameView ? keepScroll : 0;
		if (key !== null) ((key && body.querySelector(key)) || title).focus({ preventScroll: true });
	}

	function showView(v, { reveal = true } = {}) {
		view = v;
		render();
		if (reveal) show();
	}

	return {
		el,
		showWelcome: () => showView({ type: "welcome" }),
		showStop: (i) => showView({ type: "stop", index: i }),
		showFinish: () => showView({ type: "finish" }),
		showInfo: (kind, id) => showView({ type: "info", kind, id }),
		refresh: render,
		show,
		hide,
		setExpanded,
		isHovered: () => hovering,
		get view() {
			return view;
		},
	};
}
