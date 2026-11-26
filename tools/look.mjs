// Quick look: serve the site, open it at desktop and phone sizes, collect console errors, and
// take screenshots of a few views. Usage: node look.mjs [outDir] [route ...]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "/Users/keshav/Desktop/cheese-line-sim/tests/node_modules/playwright/index.mjs";

const ROOT = "/Users/keshav/Desktop/cheese-line-sim";
const OUT = process.argv[2] ?? "/tmp/cheese-line-shots";
const ROUTES = process.argv.length > 3 ? process.argv.slice(3) : ["#/", "#/ride/line/denester", "#/ride/line/apples-b", "#/ride/line/cheese-b", "#/ride/line/inspect-1", "#/ride/line/outfeed", "#/person/operator-1", "#/place/rework-1", "#/section/throughput"];
mkdirSync(OUT, { recursive: true });
const port = 9300 + Math.floor(Math.random() * 500);
const server = spawn(process.execPath, [`${ROOT}/tools/serve.mjs`, String(port)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 600));
const browser = await chromium.launch({ channel: "chrome" });
const VPS = [
	{ name: "desktop", opts: { viewport: { width: 1440, height: 900 } } },
	{ name: "phone", opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
];
const errors = [];
try {
	for (const vp of VPS) {
		const ctx = await browser.newContext(vp.opts);
		const page = await ctx.newPage();
		page.on("console", (m) => m.type() === "error" && errors.push(`[${vp.name}] ${m.text()}`));
		page.on("pageerror", (e) => errors.push(`[${vp.name}] ${e.stack ?? e}`));
		await page.goto(`http://localhost:${port}/`);
		await page.waitForFunction(() => window.__rt?.ready, null, { timeout: 15000 });
		for (const route of ROUTES) {
			await page.evaluate((h) => (location.hash = h), route);
			await page.waitForTimeout(1600);
			await page.evaluate(() => window.__rt.finishMove());
			await page.waitForTimeout(900);
			const name = route.replace(/[#/]+/g, "_").replace(/^_|_$/g, "") || "home";
			await page.screenshot({ path: `${OUT}/${vp.name}-${name}.png` });
		}
		await ctx.close();
	}
} finally {
	await browser.close();
	server.kill();
}
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
console.log(`shots in ${OUT}`);
