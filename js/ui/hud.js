// Top HUD: menu (overview, the tray ride, throughput, people, about), stops-seen counter, follow
// camera, route list, and view options (labels, reduce motion). On phones the options fold into
// a "More" menu.

import { $, h } from "../core/dom.js";
import { systemReducedMotion } from "../core/state.js";
import { icon } from "./icons.js";

export function initHud(app) {
	const C = app.content;
	const hud = $("#hud");
	const menuBtn = h("button", { class: "hud-btn", type: "button", id: "ride-menu-btn", "aria-haspopup": "true", "aria-expanded": "false", "aria-controls": "ride-menu", "aria-label": "Menu", html: `${icon("menu")}<span class="hud-btn-text">Menu</span>` });
	const menu = h("div", { class: "popover", id: "ride-menu", role: "menu", hidden: true });
	const brand = h("button", { class: "hud-brand linklike", type: "button", "aria-label": `${C.meta.title}: overview` }, C.meta.title);
	brand.addEventListener("click", () => app.router.go({ name: "park" }));
	const viewTitle = h("span", { class: "hud-ride-title" });
	const counter = h("div", { class: "hud-counter", id: "seen-counter", role: "status" }, h("span", { class: "counter-label" }, "Stops seen"), h("span", { class: "counter-value" }));
	const follow = h("button", { class: "hud-btn", type: "button", id: "toggle-follow", "aria-pressed": "false", "aria-label": "Follow camera", title: "Follow camera", html: icon("follow") });
	const route = h("button", { class: "hud-btn", type: "button", id: "route-btn", "aria-expanded": "false", "aria-controls": "route-drawer", "aria-label": "Route list", title: "Route list", html: `${icon("route")}<span class="hud-btn-text">Route</span>` });
	const more = h("button", { class: "hud-btn hud-more", type: "button", id: "more-btn", "aria-expanded": "false", "aria-controls": "hud-opts", "aria-label": "More options", html: icon("more") });
	const labels = h("button", { class: "hud-btn", type: "button", id: "toggle-labels", "aria-pressed": "false", "aria-label": "Labels", title: "Labels", html: `${icon("labels")}<span class="opt-label">Labels</span>` });
	const motion = h("button", { class: "hud-btn", type: "button", id: "toggle-motion", "aria-pressed": "false", "aria-label": "Reduce motion", title: "Reduce motion", html: `${icon("motion")}<span class="opt-label">Reduce motion</span>` });
	const opts = h("div", { class: "hud-opts", id: "hud-opts" }, labels, motion);
	hud.append(
		h("div", { class: "hud-group" }, h("div", { class: "menu-wrap" }, menuBtn, menu), brand, viewTitle),
		h("div", { class: "hud-spacer" }),
		counter,
		h("div", { class: "hud-group" }, follow, route, h("div", { class: "menu-wrap" }, more, opts)),
	);

	const closeMenus = (restoreFocus = false) => {
		const a = document.activeElement;
		const back = !restoreFocus ? null : !menu.hidden && menu.contains(a) ? menuBtn : opts.classList.contains("open") && opts.contains(a) ? more : null;
		menu.hidden = true;
		menuBtn.setAttribute("aria-expanded", "false");
		opts.classList.remove("open");
		more.setAttribute("aria-expanded", "false");
		back?.focus();
	};
	menu.addEventListener("keydown", (e) => {
		if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
		e.preventDefault();
		const items = [...menu.querySelectorAll(".menu-item:not(:disabled)")];
		const i = items.indexOf(document.activeElement);
		items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
	});

	function renderMenu() {
		menu.replaceChildren();
		const kind = app.viewKind;
		const item = (label, route, current) => {
			const b = h("button", { class: "menu-item", type: "button", role: "menuitem", "aria-current": current ? "true" : "false" }, h("span", {}, label));
			b.addEventListener("click", () => {
				closeMenus(true);
				app.router.go(route);
			});
			menu.append(b);
		};
		item("Overview", { name: "park" }, kind === "overview");
		item(C.ride.title, { name: "ride", rideId: C.ride.id }, kind === "ride");
		item(C.sections.throughput.title, { name: "section", id: "throughput" }, kind === "section");
		for (const p of C.people) item(`${p.title}: ${p.role}`, { name: "person", id: p.id }, false);
		item(C.sections.about.title, { name: "section", id: "about" }, false);
	}

	menuBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		const open = menu.hidden;
		closeMenus();
		if (open) {
			renderMenu();
			menu.hidden = false;
			menuBtn.setAttribute("aria-expanded", "true");
			menu.querySelector(".menu-item")?.focus();
		}
	});
	more.addEventListener("click", (e) => {
		e.stopPropagation();
		const open = !opts.classList.contains("open");
		closeMenus();
		if (open) {
			opts.classList.add("open");
			more.setAttribute("aria-expanded", "true");
		}
	});
	document.addEventListener("pointerdown", (e) => {
		if (!hud.contains(e.target)) closeMenus();
	});
	follow.addEventListener("click", () => app.state.set("follow", !app.state.get("follow")));
	labels.addEventListener("click", () => app.state.set("labels", !app.state.get("labels")));
	motion.addEventListener("click", () => {
		const next = !app.reducedMotion();
		app.state.set("reduceMotion", next === systemReducedMotion() ? null : next);
	});
	route.addEventListener("click", () => app.route.toggle());

	function update() {
		const seen = app.seenCount();
		counter.querySelector(".counter-value").textContent = `${seen.seen} / ${seen.total}`;
		counter.setAttribute("aria-label", `Stops seen: ${seen.seen} of ${seen.total}`);
		follow.setAttribute("aria-pressed", app.state.get("follow") ? "true" : "false");
		labels.setAttribute("aria-pressed", app.state.get("labels") ? "true" : "false");
		motion.setAttribute("aria-pressed", app.reducedMotion() ? "true" : "false");
		viewTitle.textContent = app.viewKind === "ride" ? C.ride.title : "";
		route.disabled = !app.runner.loaded;
		follow.disabled = !app.runner.loaded || app.viewKind !== "ride";
		route.setAttribute("aria-expanded", app.route.isOpen() ? "true" : "false");
	}

	return { update, closeMenus, menuOpen: () => !menu.hidden || opts.classList.contains("open") };
}
