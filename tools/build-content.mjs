#!/usr/bin/env node
// Content generator: compiles content/line.md (the process design, as markdown) into
// js/content.js, the only file the site reads text from. Node built-ins only.
//
//   node tools/build-content.mjs           validate and write js/content.js
//   node tools/build-content.mjs --check   validate only
//
// Format (see content/FORMAT.md):
//   # Line                      key: value lines (title, subtitle, tagline)
//   ## Stop: <id>               key: value lines (title, cargo, cargo_detail, station), then
//                               ### At this stop  (markdown)
//   ## Station: <id>            title: line, then markdown body
//   ## Person: <id>             title, role, where, then markdown body
//   ## Place: <id>              title, then markdown body (things on the map that are not stops)
//   ## Section: <id>            title, then markdown body (about, throughput, shift, ...)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const SRC = join(ROOT, "content", "line.md");
const OUT = join(ROOT, "js", "content.js");

/** Stop ids the drawing code keys on (js/line/layout.js). Content must define exactly these. */
const STOP_IDS = ["denester", "grapes", "apples-a", "apples-b", "crackers", "cheese-a", "cheese-b", "buffer", "inspect-1", "lidding", "inspect-2", "outfeed"];
const PERSON_IDS = ["operator-1", "operator-2", "technician"];
const PLACE_IDS = ["supply-aisle", "staging", "rework-1", "rework-2", "cart-slots", "dispatch", "cabinet"];
const SECTION_IDS = ["about", "ai-usage", "how-to-read", "throughput", "shift", "roster"];

const errors = [];
const warnings = [];
const err = (line, msg) => errors.push(`content/line.md:${line}: ${msg}`);

// ---------------------------------------------------------------------------
// Inline and block markdown (the subset the design document uses)

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s) {
	let out = esc(s);
	out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
	out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
	out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
		const internal = href.startsWith("#");
		return `<a href="${href}"${internal ? ' class="internal-link"' : ' target="_blank" rel="noopener"'}>${text}</a>`;
	});
	// (A) marks an assumption in the design document.
	out = out.replace(/\(A\)/g, '<abbr class="assume" title="Assumption, to confirm in a vendor trial or time study">(A)</abbr>');
	return out;
}

function splitRow(line) {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((c) => c.trim());
}

/** Render a markdown block (array of {text, line}) to HTML. */
function blocks(lines) {
	const html = [];
	let i = 0;
	const isList = (t) => /^\s*[-*] /.test(t) || /^\s*\d+\. /.test(t);
	while (i < lines.length) {
		const { text } = lines[i];
		if (!text.trim() || /^-{3,}$/.test(text.trim())) {
			i++;
			continue;
		}
		const hm = /^(#{3,5})\s+(.*)$/.exec(text);
		if (hm) {
			const level = Math.min(5, hm[1].length + 1);
			html.push(`<h${level}>${inline(hm[2])}</h${level}>`);
			i++;
			continue;
		}
		if (text.trim().startsWith("|")) {
			const rows = [];
			while (i < lines.length && lines[i].text.trim().startsWith("|")) rows.push(lines[i++].text);
			const head = splitRow(rows[0]);
			const body = rows.slice(2).map(splitRow);
			const numeric = head.map((_, c) => body.length > 0 && body.every((r) => /^[\s*]*[\d.,~%x-]+[\s*]*(s|%)?[\s*]*$/.test(r[c] ?? "") || !(r[c] ?? "").trim()));
			const cell = (tag, c, v) => `<${tag}${numeric[c] ? ' class="num"' : ""}>${inline(v ?? "")}</${tag}>`;
			html.push(
				`<div class="table-wrap"><table><thead><tr>${head.map((v, c) => cell("th", c, v)).join("")}</tr></thead><tbody>${body
					.map((r) => `<tr>${head.map((_, c) => cell("td", c, r[c])).join("")}</tr>`)
					.join("")}</tbody></table></div>`,
			);
			continue;
		}
		if (isList(text)) {
			// Nested lists by indentation; continuation lines join the item above.
			const items = [];
			while (i < lines.length && (isList(lines[i].text) || (lines[i].text.trim() && /^\s{2,}/.test(lines[i].text)))) {
				const t = lines[i].text;
				const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(t);
				if (m) items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
				else if (items.length) items[items.length - 1].text += ` ${t.trim()}`;
				i++;
			}
			const render = (start, indent) => {
				let out = "";
				let k = start;
				const ordered = items[start].ordered;
				out += ordered ? "<ol>" : "<ul>";
				while (k < items.length && items[k].indent >= indent) {
					if (items[k].indent > indent) {
						const [sub, next] = render(k, items[k].indent);
						out = out.replace(/<\/li>$/, `${sub}</li>`);
						k = next;
						continue;
					}
					out += `<li>${inline(items[k].text)}</li>`;
					k++;
				}
				out += ordered ? "</ol>" : "</ul>";
				return [out, k];
			};
			html.push(render(0, items[0].indent)[0]);
			continue;
		}
		const para = [];
		while (i < lines.length && lines[i].text.trim() && !isList(lines[i].text) && !lines[i].text.trim().startsWith("|") && !/^#{3,5}\s/.test(lines[i].text)) para.push(lines[i++].text.trim());
		html.push(`<p>${inline(para.join(" "))}</p>`);
	}
	return html.join("\n");
}

// ---------------------------------------------------------------------------
// Parse the file into entries

// HTML comments are notes for editors: blank them out, keeping line numbers for error messages.
const src = readFileSync(SRC, "utf8")
	.replace(/\r\n/g, "\n")
	.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ""));
const all = src.split("\n").map((text, k) => ({ text, line: k + 1 }));

for (const { text, line } of all) if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) err(line, "no emojis");

const entries = [];
let cur = null;
for (const l of all) {
	const top = /^#\s+(.*)$/.exec(l.text);
	const h2 = /^##\s+(Stop|Station|Person|Place|Section):\s*([a-z0-9-]+)\s*$/.exec(l.text);
	if (top) {
		cur = { kind: "Line", id: "line", line: l.line, lines: [] };
		entries.push(cur);
	} else if (h2) {
		cur = { kind: h2[1], id: h2[2], line: l.line, lines: [] };
		entries.push(cur);
	} else if (/^##\s/.test(l.text)) err(l.line, `unknown heading "${l.text}" (expected ## Stop|Station|Person|Place|Section: id)`);
	else if (cur) cur.lines.push(l);
}

/** Leading key: value lines, then the rest split by ### headings. */
function fields(e) {
	const f = {};
	let k = 0;
	while (k < e.lines.length) {
		const t = e.lines[k].text;
		if (!t.trim()) {
			k++;
			if (Object.keys(f).length) break;
			continue;
		}
		const m = /^([a-z_]+):\s*(.*)$/.exec(t);
		if (!m) break;
		f[m[1]] = m[2].trim();
		k++;
	}
	const body = e.lines.slice(k);
	const parts = {};
	let name = "";
	parts[name] = [];
	for (const l of body) {
		const m = /^###\s+(.*)$/.exec(l.text);
		if (m && e.kind === "Stop") {
			name = m[1].trim().toLowerCase();
			parts[name] = [];
		} else parts[name].push(l);
	}
	return { f, body, parts };
}

function need(e, f, keys) {
	for (const key of keys) if (!f[key]) err(e.line, `${e.kind} ${e.id}: missing "${key}:"`);
}

const out = { meta: {}, ride: null, stations: {}, people: [], places: {}, sections: {} };
const stops = [];
for (const e of entries) {
	const { f, body, parts } = fields(e);
	if (e.kind === "Line") {
		need(e, f, ["title", "subtitle", "ride_title"]);
		out.meta = { title: f.title, subtitle: f.subtitle, tagline: f.tagline ?? "" };
		out.rideTitle = f.ride_title;
	} else if (e.kind === "Stop") {
		need(e, f, ["title", "cargo", "station"]);
		const here = parts["at this stop"];
		if (!here || !here.some((l) => l.text.trim())) err(e.line, `Stop ${e.id}: needs a "### At this stop" section`);
		stops.push({ id: e.id, line: e.line, title: f.title, cargo: f.cargo, cargoDetail: f.cargo_detail ?? null, station: f.station, here: blocks(here ?? []) });
	} else if (e.kind === "Station") {
		need(e, f, ["title"]);
		out.stations[e.id] = { title: f.title, short: f.short ?? f.title, html: blocks(body) };
	} else if (e.kind === "Person") {
		need(e, f, ["title", "role", "where"]);
		out.people.push({ id: e.id, title: f.title, role: f.role, where: f.where, html: blocks(body) });
	} else if (e.kind === "Place") {
		need(e, f, ["title"]);
		out.places[e.id] = { title: f.title, short: f.short ?? f.title, html: blocks(body) };
	} else if (e.kind === "Section") {
		need(e, f, ["title"]);
		out.sections[e.id] = { title: f.title, html: blocks(body) };
	}
}

// ---------------------------------------------------------------------------
// Validate ids and references

const ids = stops.map((s) => s.id);
for (const id of STOP_IDS) if (!ids.includes(id)) errors.push(`content/line.md: missing ## Stop: ${id}`);
for (const s of stops) {
	if (!STOP_IDS.includes(s.id)) err(s.line, `unknown stop id "${s.id}" (the drawing code knows ${STOP_IDS.join(", ")})`);
	if (!out.stations[s.station]) err(s.line, `Stop ${s.id}: unknown station "${s.station}"`);
}
if (ids.join() !== STOP_IDS.filter((id) => ids.includes(id)).join()) errors.push(`content/line.md: stops must be in line order: ${STOP_IDS.join(", ")}`);
for (const id of PERSON_IDS) if (!out.people.some((p) => p.id === id)) errors.push(`content/line.md: missing ## Person: ${id}`);
for (const id of PLACE_IDS) if (!out.places[id]) errors.push(`content/line.md: missing ## Place: ${id}`);
for (const id of SECTION_IDS) if (!out.sections[id]) errors.push(`content/line.md: missing ## Section: ${id}`);

// Internal links must point at something that exists.
const known = new Set([...STOP_IDS.map((id) => `#/ride/line/${id}`), ...Object.keys(out.stations).map((id) => `#/station/${id}`), ...PERSON_IDS.map((id) => `#/person/${id}`), ...PLACE_IDS.map((id) => `#/place/${id}`), ...SECTION_IDS.map((id) => `#/section/${id}`)]);
for (const { text, line } of all) for (const m of text.matchAll(/\]\((#[^)\s]+)\)/g)) if (!known.has(m[1])) err(line, `link to unknown target ${m[1]}`);

out.ride = { id: "line", title: out.rideTitle, stops: stops.map(({ line, ...s }) => s) };
delete out.rideTitle;

const summary = `${stops.length} stops, ${Object.keys(out.stations).length} stations, ${out.people.length} people, ${Object.keys(out.places).length} places, ${Object.keys(out.sections).length} sections | ${warnings.length} warnings, ${errors.length} errors`;
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(summary);
if (errors.length) process.exit(1);
if (!CHECK) {
	writeFileSync(OUT, `// Generated by tools/build-content.mjs from content/line.md. Do not edit by hand.\nexport const CONTENT = ${JSON.stringify(out, null, "\t")};\n`);
	console.log("wrote js/content.js");
}
