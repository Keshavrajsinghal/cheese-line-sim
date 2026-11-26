// Hash routes (all show the plant; the panel changes):
//   #/                      overview (welcome panel)
//   #/ride/line[/<stopId>]  the tray ride, at a stop
//   #/station/<id>          a station's full design section
//   #/person/<id>           a person's role and workload
//   #/place/<id>            something on the map that is not a stop (aisle, rework table, ...)
//   #/section/<id>          a document section (about, throughput, shift, ...)

const INFO = new Set(["station", "person", "place", "section"]);

export function parseHash(hash) {
	const parts = String(hash ?? "")
		.replace(/^#\/?/, "")
		.split("/")
		.filter(Boolean)
		.map((p) => {
			try {
				return decodeURIComponent(p);
			} catch {
				return p;
			}
		});
	if (parts[0] === "ride") return parts[1] ? { name: "ride", rideId: parts[1], stopId: parts[2] ?? null } : { name: "park" };
	if (INFO.has(parts[0]) && parts[1]) return { name: parts[0], id: parts[1] };
	return { name: "park" };
}

export function hashFor(route) {
	if (route.name === "ride") return `#/ride/${route.rideId}${route.stopId ? `/${route.stopId}` : ""}`;
	if (INFO.has(route.name)) return `#/${route.name}/${route.id}`;
	return "#/";
}

export class Router {
	/** @param {(route: object, prev: object|null) => void} onRoute */
	constructor(onRoute) {
		this.onRoute = onRoute;
		this.current = null;
		this.base = { name: "park" };
		window.addEventListener("hashchange", () => this.handle());
	}

	start() {
		this.handle();
	}

	handle() {
		const route = parseHash(location.hash);
		const prev = this.current;
		this.current = route;
		if (!route.overlay) this.base = route;
		this.onRoute(route, prev);
	}

	/** Navigate (adds a history entry). */
	go(route) {
		const hash = typeof route === "string" ? route : hashFor(route);
		if (location.hash === hash) this.handle();
		else location.hash = hash;
	}

	/** Update the address bar without running route handlers (for example, the cart reached a stop). */
	replaceSilently(route) {
		const hash = hashFor(route);
		this.current = route;
		if (!route.overlay) this.base = route;
		try {
			history.replaceState(null, "", hash);
		} catch {
			// Some sandboxed frames refuse replaceState; the route still works in memory.
		}
	}

	/** Close the current overlay and return to the base view. */
	closeOverlay() {
		if (!this.current?.overlay) return;
		const prev = this.current;
		this.current = this.base;
		try {
			history.replaceState(null, "", hashFor(this.base));
		} catch {
			// ignore
		}
		this.onRoute(this.base, prev);
	}
}
