# Architecture

A static site (HTML, CSS, native ES modules; no build step, no dependencies) that shows one
production line: the airline cheese plate cell from the process design. It reuses the drawing
engine and UI shell of RoboTycoon (`~/Desktop/robotycoon`), trimmed to one scene.

## Content rule

Every word a viewer reads comes from `content/line.md`, compiled by `tools/build-content.mjs` into
`js/content.js`. App code holds drawing code and UI chrome (button labels like "Overview") only.
Station, people, and throughput sections are the design document's text, unchanged; stop and place
entries only restate it. To change what the site says, edit `content/line.md` and rebuild.

```
node tools/build-content.mjs          # validate and write js/content.js
node tools/build-content.mjs --check  # validate only
```

Content shape (`CONTENT`):

```
meta     { title, subtitle, tagline }
ride     { id: "line", title, stops: [{ id, title, cargo, cargoDetail, station, here (html) }] }
stations { <id>: { title, short, html } }     denester grapes apples crackers cheese inspect-1 lidding inspect-2 outfeed
people   [{ id, title, role, where, html }]   operator-1 operator-2 technician
places   { <id>: { title, html } }            supply-aisle staging rework-1 rework-2 cart-slots dispatch cabinet
sections { <id>: { title, html } }            about ai-usage how-to-read throughput shift roster
```

Stop ids are fixed (the generator checks them): denester, grapes, apples-a, apples-b, crackers,
cheese-a, cheese-b, buffer, inspect-1, lidding, inspect-2, outfeed.

## Files

```
index.html               shell: canvas, label overlay, HUD, controls, route drawer, panel
css/app.css              layout and theme (from RoboTycoon) plus the additions at the end
js/main.js               boot: content, scene, ride runner, router, panel views, test API
js/core/                 dom helpers, event bus, router (hash routes), persisted state
js/engine/               iso projection and renderer, scene, track, ride runner, cart, robots, food
js/ui/                   HUD, controls, route list, panel, modal, icons
js/line/layout.js        every coordinate on the floor (single source; see below)
js/line/clock.js         the line's step clock, tray positions, what each tray holds
js/line/schedule.js      people timelines, feeder levels, cart states, rejects on tables
js/line/common.js        palette, object()/floorRect() helpers, guard fence drawing
js/line/food.js          the plate model and each food item (drawable on its own)
js/line/plant.js         building: floors, walls, aisles, staging racks, guard fence, warm corridor
js/line/belts.js         tray belt, accumulation conveyor, the moving trays
js/line/st-head.js       tray denester, grape station, cracker station
                         (helpers st-head-{parts,denester,grapes,crackers}.js)
js/line/st-apples.js     apple station (st-apples-arm.js: the six-axis arm)
js/line/st-cheese.js     cheese station (st-cheese-delta.js: the deltas and their cups)
js/line/st-downstream.js stop gates, inspections, pushers, lanes, re-entry chutes, rework tables, lidding, coder
                         (helpers st-downstream-{util,rework,lidding}.js)
js/line/st-outfeed.js    gantry, cart slots, light curtains, carts (st-outfeed-cart.js: the rack cart)
js/line/people.js        Operator 1, Operator 2, technician (people-pose.js: poses from the schedules;
                         people-carry.js: carried stock; people-cabinet.js: the controller cabinet)
tools/look.mjs           screenshots of chosen routes at desktop and phone sizes, with console errors
js/line/places.js        map labels and hit areas for places that are not stops
js/line/stations.js      the builder list and the stop labels
js/line/ride.js          the ride module: track, scenery, cargo on the cart, close-up
tools/build-content.mjs  content generator and validator
tools/serve.mjs          static server for local use and tests
tests/smoke.mjs          headless checks (Playwright + installed Chrome), phone and desktop
```

## World, projection, drawing

World meters: x grows toward the lower right of the screen, y toward the lower left, z up. The line
runs along +y. `IsoRenderer` (js/engine/iso.js) draws flat-shaded low-poly primitives: box, prism,
cylinder, tube, cone, sphere, beam, orientedBox, quad (any planar polygon), mesh, ground, line,
polyline, shadow, billboard. Inside one draw call, draw parts back to front yourself (painter's
order: larger x + y is closer to the viewer). The scene depth-sorts items, not primitives.

Scene items (js/engine/scene.js):
- `object(scene, x0, y0, x1, y1, h, draw, {group, live})` (common.js): one static item, cached
  offscreen. Split long objects into pieces of about 2 m so x + y sorting stays right.
- `scene.addDynamic({ group, depth: n | () => n, bounds: [x0,y0,z0,x1,y1,z1] | () => [...],
  animated: () => true, draw: (r, t) => ... })`: drawn every frame; `t` is scene time in seconds.
- Use `live: true` on static occluders that must sort against moving parts.

Food and trays are drawn about 2.5x real size so they read at map zoom; machines are drawn at a
matching scale. Robot helpers: js/engine/robots.js (drawDelta, drawSixAxis, drawSoftFingers,
drawScara, drawGantry, ik2, shuttle, dip). RoboTycoon's ride 1 helpers
(`~/Desktop/robotycoon/js/rides/ride1-robots.js`, `ride1-cells.js`, `ride1-machines.js`) have a
tilting six-axis arm, vacuum and bellows cups, gantry parts, guard panels, a denester, a lidder,
and more; copy what helps into this repo rather than importing across repositories.

## The line clock (js/line/clock.js)

One step = the belt moves every tray forward one position (`MOVE` = 1.5 s), then every station
works on a still tray for `WORK` = 5.87 s (`CYCLE` = 7.37 s, the design's full-speed step).
`clock(t)` gives `{n, u}` (step count, seconds into the step); `work(u) = u - MOVE` is the time
into the work window. `POS[k]` is the y of tray position k; `P[name]` names key positions
(denester 0, grapes 2, apples-a 4, apples-b 5, crackers 7, cheese-a 9, cheese-b 10, buffer,
inspect-1, pusher1, lidding, coder, inspect-2, pusher2, outfeed). Tray m sits at position
k = n - m. `contents(m, k, u)` says what it holds (or null once pushed off or lifted).

Stations must land items exactly at `PLACE[station]` times (seconds into the work window): the
belt trays (belts.js) gain the item at that moment, so the robot must be at the tray, releasing,
then. A robot carries the item from its pick until that time. Rejects: `isReject1(m)` (one wedge
short, pushed to Rework Table 1) and `isReject2(m)` (lid not seated, to Rework Table 2).
`GANTRY_LIFT`: when the gantry lifts the tray at the outfeed (it then reaches its cart position
2.6 s later; see schedule.js `plateTime`).

Every builder gets `T(t)` (ride.js): line time = scene time + START (40 steps, so the line opens
in steady state and every tray on screen has a history in the carts and rework tables). Use `T(t)`
instead of raw scene time; under reduced motion it returns a fixed mid-step time. For timed
screenshots, set `window.__rt.app.scene.time` and remember the START offset (about 294.8 s).

## Schedules (js/line/schedule.js)

- `op1(t)`: Operator 1's pose `{x, y, facing, kind, walk, carry, task}`. kind: walk, pick (at a
  staging bay), load (at a feeder; task = feeder id), collect / drop (empties), watch.
  carry: pocket, apples, packs, cheese, cheese2, lids, trays, empties, or null.
- `level(feederId, t)`: 0.2..1, how full each feeder is (grapes, apples, crackers, cheese-1..4,
  lids, denester); it jumps to 1 at the end of Operator 1's load there. Draw stacks and hoppers
  from it.
- `op2(t)`: Operator 2's pose. kind: walk, push (pushing a cart; carry cart-full or cart-empty),
  watch, fix (at a rework table; task = table id), return (setting a plate in a re-entry
  chute; carry plate), unlatch / latch (at a cart slot).
- `carts(t)`: `{ slots: [{cart, count, phase, pos, heading}], parked, emptyWaiting, emptyPos,
  emptyHeading }`; phase filling, full, leaving, empty, arriving. Carts cross the light-curtain
  line only straight along x: Operator 2 pulls a full cart straight out, then turns toward the
  door (it trails `CART_REACH` = 1.8 m behind them); the spare empty cart is grabbed at its handle,
  swung toward the slot, pushed to a line-up point, and pushed straight in. `plateTime(j)`,
  `platesBy(t)`, `PER_CART` (24, a 4 x 6 grid). Plate j goes to cart floor(j / 24), slot cart % 2.
- Walks are routed: Operator 1 goes round the inside corner of the L-shaped supply aisle; Operator
  2 detours in front of each rework table and its lane, round the parked cart through the doorway,
  and down the wall side past the spare cart. A numeric check over 2,000 s of line time finds no
  person inside a guard, table, or cart and no cart overlapping another.
- `rejectsOn(table, t)`: plates sitting on a rework table (`fixing` once Operator 2 has it).
- `tech(t)`: the technician at the controller cabinet.

## Layout (js/line/layout.js)

All positions come from layout.js: ROOM, WARM (corridor), DOOR, STAGING, AISLE, HEAD_AISLE,
GUARD, LINE_X / BELT / BELT_Z, PITCH / slotY / SLOT, ACC / GATE, STOP_Y, STATION (each station's
footprint and key points), LANES, REENTRY, REWORK, CART_SLOTS, DISPATCH, CABINET, POSTS, REFILL,
TRACK. Feeders load from the back guard line (x = GUARD.back = 6.0), facing the supply aisle;
robots sit between the feeders and the tray belt (x 10.6 to 11.8); the front guard is at
x = 12.9; the ride track runs raised at x = 14.2.

## Engine changes from RoboTycoon

- `scene.addHit` accepts function bounds (a hit area that moves with a walking person).
- `Track.draw` takes `skipColumn(point)` (no supports over the reject lanes, re-entry chutes, or
  the outfeed) and `live` (the raised track is drawn every frame so it sorts over carts and people).
- The render loop never queues two frames.
- `guardRun` (common.js) cuts panels exactly at each opening, with posts at the edges; the back and
  head guards are live so people in the aisle sort against them.

## Map targets

The ride context (`ctx` in builders) provides `stopTarget(stopId, bounds, labelPos)`,
`placeTarget(placeId, bounds, labelPos)`, `personTarget(personId, boundsFn, labelPos)` (label
position may be a function), and `stationFocus(stationId, pos)`. Stop labels are added in
stations.js; place labels in places.js; person labels in people.js.

## Routes and panel

`#/` overview, `#/ride/line/<stop>`, `#/station/<id>`, `#/person/<id>`, `#/place/<id>`,
`#/section/<id>`. Info views keep the ride loaded and paused; "Back to the ride" returns to the
same stop. The panel (js/ui/panel.js) renders the welcome card, stops (close-up, "At this stop",
the station's full design section), the finish card, and info views.

## Test API

`window.__rt` (used by tests/smoke.mjs; not a public interface): state(), view(), select(stopId),
play(), pause(), stepForward(), stepBack(), restart(), goToStop(i, jump), finishMove(),
setSpeed(x), cartScreen(), camera(), idle(), reducedMotion(), hits(), labels(), time().
