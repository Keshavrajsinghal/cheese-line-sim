#!/usr/bin/env node
// Headless smoke test. Usage (from the repo root, after `cd tests && npm ci --ignore-scripts`):
//   node tests/smoke.mjs [--headed]
//
// Starts tools/serve.mjs on a free port, then at a phone size (390x844, touch) and a desktop size
// (1440x900, mouse): loads the site, checks the overview, rides the tray from the first stop to the
// end (route list, step buttons, keyboard, play), checks every stop's panel and cart tag against
// content, opens every person, place, station, and section view, follows an internal link, checks
// labels, reduced motion, deep links, and horizontal overflow, and fails on any console error.
// Screenshots go to tests/artifacts/.

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ART = join(ROOT, "tests", "artifacts");
const HEADED = process.argv.includes("--headed");
mkdirSync(ART, { recursive: true });

const problems = [];

function freePort() {
	return new Promise((res, rej) => {
		const s = net.createServer();
		s.once("error", rej);
		s.listen(0, "127.0.0.1", () => {
			const { port } = s.address();
			s.close(() => res(port));
		});
	});
}

async function startServer() {
	const port = await freePort();
	const proc = spawn(process.execPath, [join(ROOT, "tools", "serve.mjs"), String(port)], { stdio: ["ignore", "pipe", "pipe"] });
	await new Promise((res, rej) => {
		const t = setTimeout(() => rej(new Error("server did not start")), 8000);
		proc.stdout.on("data", (d) => {
			if (String(d).includes("serving")) {
				clearTimeout(t);
				res();
			}
		});
		proc.once("exit", (code) => rej(new Error(`server exited with ${code}`)));
	});
	return { port, proc };
}

const VIEWPORTS = [
	{ name: "phone", opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
	{ name: "desktop", opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
];

async function run(browser, base, vp) {
	const P = (msg) => problems.push(`[${vp.name}] ${msg}`);
	const context = await browser.newContext({ ...vp.opts, reducedMotion: "no-preference" });
	const page = await context.newPage();
	page.setDefaultTimeout(10000);
	page.on("console", (m) => m.type() === "error" && P(`console error: ${m.text()} ${m.location()?.url ?? ""}`));
	page.on("pageerror", (e) => P(`page error: ${e.message}`));
	page.on("requestfailed", (r) => P(`request failed: ${r.url()}`));
	page.on("response", (r) => r.status() >= 400 && P(`HTTP ${r.status()} ${r.url()}`));

	let shot = 0;
	const screenshot = async (name) => {
		shot++;
		await page.waitForTimeout(250);
		await page.screenshot({ path: join(ART, `${vp.name}-${String(shot).padStart(2, "0")}-${name}.png`) });
	};
	const step = async (name, fn) => {
		try {
			await fn();
		} catch (e) {
			P(`${name}: ${String(e.message ?? e).split("\n")[0]}`);
			await page.screenshot({ path: join(ART, `${vp.name}-FAIL-${name.replace(/[^a-z0-9]+/gi, "-")}.png`) }).catch(() => {});
		}
	};
	const expect = (cond, msg) => {
		if (!cond) throw new Error(msg);
	};
	const noOverflow = async (where) => {
		const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, w: window.innerWidth }));
		if (o.doc > o.w + 1 || o.body > o.w + 1) P(`horizontal overflow at ${where}: ${Math.max(o.doc, o.body)}px in a ${o.w}px window`);
	};
	const rt = (fn, arg) => page.evaluate(fn, arg);
	const settle = async () => {
		await page.waitForFunction(() => !window.__rt.state().moving, null, { timeout: 20000 });
		await page.waitForTimeout(150);
	};
	const panelTitle = () => page.locator("#panel-title").innerText();
	const tagText = () => page.locator(".label-cart .cargo").innerText();
	const hudClick = async (sel) => {
		if ((await page.locator("#more-btn").isVisible()) && !(await page.locator("#hud-opts.open").count())) await page.click("#more-btn");
		await page.click(sel);
	};

	await page.goto(`${base}/`);
	await page.waitForFunction(() => window.__rt?.ready === true, null, { timeout: 20000 });
	const content = await rt(() => window.__rt.content);
	const stops = content.ride.stops;

	await step("overview", async () => {
		expect((await panelTitle()) === content.meta.title, `panel title is "${await panelTitle()}"`);
		expect((await page.locator(".person-card").count()) === content.people.length, "people cards missing");
		expect((await page.locator(".station-list [data-stop]").count()) === stops.length, "station list incomplete");
		const labels = await rt(() => window.__rt.labels());
		for (const s of stops) expect(labels.some((l) => l.id === `stop-line-${s.id}`), `no map label for stop ${s.id}`);
		for (const p of content.people) expect(labels.some((l) => l.id === `person-${p.id}`), `no map label for ${p.id}`);
		for (const id of Object.keys(content.places)) expect(labels.some((l) => l.id === `place-${id}`), `no map label for place ${id}`);
		await noOverflow("overview");
		await screenshot("overview");
	});

	await step("start the ride", async () => {
		if (vp.name === "phone") await page.locator("#panel").evaluate((el) => (el.dataset.state = "expanded"));
		await page.click("[data-start-ride]");
		await page.waitForFunction(() => window.__rt.view() === "ride" && window.__rt.state().stopId);
		await settle();
		const s = await rt(() => window.__rt.state());
		expect(s.stopId === stops[0].id, `boarded at ${s.stopId}`);
		expect((await panelTitle()) === stops[0].title, "first stop title");
		expect((await tagText()) === stops[0].cargo, `cart tag "${await tagText()}"`);
		await screenshot("first-stop");
	});

	await step("step forward through every stop", async () => {
		for (let i = 1; i < stops.length; i++) {
			await page.click('[data-act="forward"]');
			await settle();
			const s = await rt(() => window.__rt.state());
			expect(s.stopId === stops[i].id, `step ${i}: at ${s.stopId}, expected ${stops[i].id}`);
			expect((await panelTitle()) === stops[i].title, `step ${i}: panel title "${await panelTitle()}"`);
			expect((await tagText()) === stops[i].cargo, `step ${i}: tag "${await tagText()}"`);
			const station = content.stations[stops[i].station];
			expect(await page.locator("#panel-body details[data-key] summary").first().innerText().then((t) => t.includes(station.title)), `step ${i}: station section missing`);
			if (["apples-b", "cheese-b", "inspect-1", "outfeed"].includes(stops[i].id)) await screenshot(`stop-${stops[i].id}`);
		}
		await noOverflow("last stop");
	});

	await step("finish", async () => {
		await page.click('[data-act="forward"]');
		await settle();
		await page.waitForSelector("[data-ride-complete]");
		await screenshot("finish");
	});

	await step("route list rides to any stop", async () => {
		await page.click('[data-act="restart"]');
		await settle();
		await page.click("#route-btn");
		await page.waitForSelector("#route-drawer:not([hidden])");
		const target = stops[6];
		await page.click(`#route-drawer [data-stop="${target.id}"]`);
		await settle();
		await page.waitForFunction((id) => window.__rt.state().stopId === id, target.id);
		expect((await panelTitle()) === target.title, "route list stop title");
		if (await page.locator("#route-drawer:not([hidden])").count()) await page.click("#route-btn");
	});

	await step("step back and keyboard", async () => {
		const before = (await rt(() => window.__rt.state())).index;
		await page.click('[data-act="back"]');
		await settle();
		const after = (await rt(() => window.__rt.state())).index;
		expect(after === before - 1, `step back went ${before} -> ${after}`);
		await page.locator("#park-canvas").focus().catch(() => {});
		await page.evaluate(() => document.activeElement?.blur());
		await page.keyboard.press("ArrowRight");
		await settle();
		expect((await rt(() => window.__rt.state())).index === before, "ArrowRight did not step forward");
	});

	await step("play advances", async () => {
		await rt(() => window.__rt.setSpeed(4));
		const i0 = (await rt(() => window.__rt.state())).index;
		await page.click('[data-act="play"]');
		await page.waitForFunction((i) => window.__rt.state().index > i, i0, { timeout: 20000 });
		await page.click('[data-act="play"]');
		await rt(() => window.__rt.setSpeed(1));
	});

	await step("people, places, stations, sections", async () => {
		for (const p of content.people) {
			await rt((id) => (location.hash = `#/person/${id}`), p.id);
			await page.waitForFunction((t) => document.querySelector("#panel-title")?.textContent === t, p.title);
			expect(await page.locator("#panel-body .person-text").count(), `${p.id}: no workload text`);
		}
		await screenshot("person");
		for (const [id, place] of Object.entries(content.places)) {
			await rt((x) => (location.hash = `#/place/${x}`), id);
			await page.waitForFunction((t) => document.querySelector("#panel-title")?.textContent === t, place.title);
		}
		for (const [id, s] of Object.entries(content.stations)) {
			await rt((x) => (location.hash = `#/station/${x}`), id);
			await page.waitForFunction((t) => document.querySelector("#panel-title")?.textContent === t, s.title);
		}
		for (const [id, s] of Object.entries(content.sections)) {
			await rt((x) => (location.hash = `#/section/${x}`), id);
			await page.waitForFunction((t) => document.querySelector("#panel-title")?.textContent === t, s.title);
		}
		expect(await page.locator("#panel-body table").count(), "the last section (no tables?)");
		await rt(() => (location.hash = "#/section/throughput"));
		await page.waitForFunction(() => document.querySelectorAll("#panel-body table").length >= 4);
		await screenshot("throughput");
		await noOverflow("throughput");
	});

	await step("back to the ride keeps the stop", async () => {
		await rt(() => window.__rt.select("lidding"));
		await page.waitForFunction(() => window.__rt.state().stopId === "lidding");
		await rt(() => (location.hash = "#/person/operator-2"));
		await page.waitForSelector("[data-back-ride]");
		await page.click("[data-back-ride]");
		await page.waitForFunction(() => window.__rt.view() === "ride");
		expect((await rt(() => window.__rt.state())).stopId === "lidding", "came back to a different stop");
	});

	await step("map labels open views", async () => {
		await rt(() => (location.hash = "#/"));
		await page.waitForFunction(() => window.__rt.view() === "overview");
		await page.waitForTimeout(900);
		const label = page.locator("button.label-sign").first();
		await label.click();
		await page.waitForFunction(() => window.__rt.view() === "place");
		const p = page.locator("button.label-person").first();
		await p.click({ force: true });
		await page.waitForFunction(() => window.__rt.view() === "person");
	});

	await step("internal links", async () => {
		await rt(() => (location.hash = "#/place/rework-1"));
		await page.waitForSelector("#panel-body a.internal-link");
		await page.locator("#panel-body a.internal-link").first().click();
		await page.waitForFunction(() => location.hash !== "#/place/rework-1");
	});

	await step("labels toggle", async () => {
		await rt(() => (location.hash = "#/"));
		await page.waitForFunction(() => window.__rt.view() === "overview");
		await hudClick("#toggle-labels");
		expect(await page.locator("#park-overlay.labels-off").count(), "labels did not hide");
		await hudClick("#toggle-labels");
		if (await page.locator("#hud-opts.open").count()) await page.click("#more-btn");
	});

	await step("deep link and unknown route", async () => {
		await page.goto(`${base}/#/ride/line/inspect-2`);
		await page.waitForFunction(() => window.__rt?.ready && window.__rt.state().stopId === "inspect-2");
		await page.goto(`${base}/#/person/nobody`);
		await page.waitForFunction(() => window.__rt?.ready && window.__rt.view() === "overview");
	});

	await context.close();

	// Reduced motion: the cart jumps between stops instead of riding.
	const rm = await browser.newContext({ ...vp.opts, reducedMotion: "reduce" });
	const p2 = await rm.newPage();
	p2.on("pageerror", (e) => P(`page error (reduced motion): ${e.message}`));
	await step("reduced motion", async () => {
		await p2.goto(`${base}/#/ride/line/denester`);
		await p2.waitForFunction(() => window.__rt?.ready && window.__rt.state().stopId === "denester");
		await p2.evaluate(() => window.__rt.stepForward());
		const s = await p2.evaluate(() => window.__rt.state());
		expect(!s.moving && s.stopId === "grapes", `reduced motion: ${JSON.stringify(s)}`);
	});
	await rm.close();
}

async function narrow(browser, base) {
	const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
	const page = await ctx.newPage();
	page.on("pageerror", (e) => problems.push(`[360] page error: ${e.message}`));
	await page.goto(`${base}/#/ride/line/cheese-b`);
	await page.waitForFunction(() => window.__rt?.ready);
	await page.waitForTimeout(800);
	for (const h of ["#/ride/line/cheese-b", "#/section/throughput", "#/person/operator-1", "#/"]) {
		await page.evaluate((x) => (location.hash = x), h);
		await page.waitForTimeout(500);
		const o = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, w: window.innerWidth }));
		if (o.doc > o.w + 1) problems.push(`[360] horizontal overflow at ${h}: ${o.doc}px`);
	}
	await page.screenshot({ path: join(ART, "narrow-360.png") });
	await ctx.close();
}

async function main() {
	const { port, proc } = await startServer();
	const base = `http://localhost:${port}`;
	let browser;
	try {
		browser = await chromium.launch({ channel: "chrome", headless: !HEADED });
		for (const vp of VIEWPORTS) {
			console.log(`smoke: ${vp.name}...`);
			await run(browser, base, vp);
		}
		await narrow(browser, base);
	} catch (e) {
		problems.push(`fatal: ${e.stack ?? e}`);
	} finally {
		await browser?.close();
		proc.kill();
	}
	if (problems.length) {
		console.log(`\nsmoke: ${problems.length} problem(s):`);
		for (const p of problems) console.log(`  - ${p}`);
		console.log(`screenshots: ${ART}`);
		process.exit(1);
	}
	console.log(`smoke: all checks passed. Screenshots: ${ART}`);
}

main();
