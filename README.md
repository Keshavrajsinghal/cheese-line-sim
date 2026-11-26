# Cheese Plate Line

Live site: https://keshavrajsinghal.github.io/cheese-line-sim/

An interactive, isometric model of my process design for an automated airline cheese plate line
(Part 1 of the Intelligent Machines take-home): about 200 plates an hour in a 2-4 C washdown room.

Each plate is a molded fiber tray with one grape bunch on the stem, 4 apple slices standing upright
and leaning, 1 sealed cracker pack, and 4 different cheese wedges in two layers, under a clear
snap-on lid with a printed use-by and lot code.

## What you can do

- **Follow one tray.** A cart rides beside the line from the empty tray to the rack cart, stopping
  at every station: tray denester, grapes, apple robots A and B, crackers, cheese robots A and B, the
  accumulation conveyor, inspection before the lid, lidding and coding, inspection after the lid,
  and the outfeed. The tag above the cart says what the tray holds at that moment; the panel shows
  the station's inputs, machine, time per plate, outputs, and failure handling.
- **Watch the line run.** Trays index along the belt at the design's 7.37 s step; each robot lands its
  item when the tray gains it; rejects slide to the rework tables; the gantry fills 24-plate carts.
- **See the people.** Operator 1 refills every feeder from the supply aisle, outside the guard.
  Operator 2 fixes rejects at both rework tables and swaps full carts. The line technician is on
  call at the heated controller cabinet outside the cold room. Click anyone to see their role,
  refill schedule, and workload.
- **Click anything** on the map (stations, feeders, rework tables, cart slots, staging, the cabinet)
  to open its part of the design, or open **Throughput** for the step time, plates per hour, line
  uptime, and stress tests.

Works on phone and desktop, with touch or a mouse, and respects reduced-motion settings.

## Run it locally

The site is static (HTML, CSS, native ES modules; no build step, no dependencies). ES modules do not
load from `file://`, so serve the folder over HTTP:

```bash
node tools/serve.mjs 8080
```

or

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080/.

## Where the words come from

Every word on screen comes from [`content/line.md`](content/line.md): the station, people, and
throughput sections are the design document's text, unchanged, and the stop and map entries only
restate it. App code holds drawing code and UI labels only. To change what the site says, edit the
markdown and rebuild the content file:

```bash
node tools/build-content.mjs          # validate and write js/content.js
node tools/build-content.mjs --check  # validate only
```

Numbers marked (A) are assumptions, to confirm in a vendor trial with real food at 3 C or a time
study during commissioning.

## Tests

`tests/smoke.mjs` loads the site headless at phone and desktop sizes, rides the tray through every
stop, checks each panel and cart tag against the content, opens every person, place, station, and
section view, and checks reduced motion, deep links, horizontal overflow, and console errors. It
uses Playwright with an installed Google Chrome:

```bash
cd tests && npm ci --ignore-scripts && cd ..
node tests/smoke.mjs
```

## How it is built

The drawing engine and UI shell come from [RoboTycoon](https://github.com/Keshavrajsinghal/robotycoon),
a larger robotics learning site, trimmed to this one line. [`ARCHITECTURE.md`](ARCHITECTURE.md)
covers the layout, the line clock that keeps every robot and person in sync, and the module
contracts; [`DECISIONS.md`](DECISIONS.md) lists the choices made when the design did not say.

## Use of AI

- Generate the design write-up from my process-line diagram and notes.
- Research the types of robots available, their capabilities, and the tasks each is suited to.
- Understand robot cycle times and develop timing estimates to calculate throughput at each station.
- Review and evaluate design decisions I made, including alternatives and tradeoffs.
- Build this interactive site from the write-up (Claude Code: layout, drawing, animation, tests).
