# Line
title: Cheese Plate Line
subtitle: An automated cell for an airline cheese plate, about 200 plates an hour
tagline: Process design, Part 1 of the Intelligent Machines take-home
ride_title: Follow one tray

<!--
Source of every word the site shows. Sections marked "unchanged" are copied from the process
design document (line-design/05-deliverable.md, the text behind the submitted PDF). Stop and place
entries only restate that document. Rebuild after editing: node tools/build-content.mjs
-->

## Section: about
title: About this design

This is an interactive version of my process design for the take-home: an automated line that builds the airline cheese plate (a molded fiber tray with one grape bunch on the stem, 4 apple slices, 1 sealed cracker pack, and 4 different cheese wedges under a clear snap-on lid) at about 200 plates an hour, in a 2-4 C washdown room.

- **Follow one tray** rides a cart beside the line from the empty tray to the rack cart, stopping at every station. The tag above the cart says what the tray holds at that moment.
- **Click anything on the map:** a station, a feeder, a rework table, a person, or the controller cabinet. Each opens its part of the design: inputs, machine, time per plate, outputs, and failure handling.
- **People** shows who works the line, where they stand, and how busy they are.
- **Throughput** shows the step time, plates per hour, line uptime, and the stress tests.

Every number here comes from the design document. Numbers marked (A) are assumptions, to confirm in a vendor trial with real food at 3 C or in a time study during commissioning.

### Note on the document

I drew the process-line diagram and used an LLM to turn it into the accompanying write-up, covering each station's inputs, throughput, and failure handling. This site presents the same design: the station, people, and throughput sections are the write-up's text.

## Section: ai-usage
title: Use of AI

- Generate the write-up from my process-line diagram and notes.
- Research the types of robots available, their capabilities, and the tasks each is suited to.
- Understand robot cycle times and develop timing estimates to calculate throughput at each station.
- Review and evaluate design decisions I made, including alternatives and tradeoffs.
- Build this interactive site from the write-up.

## Stop: denester
title: Tray denester
cargo: Empty fiber tray
cargo_detail: Seated in a fixed pocket on the indexing belt
station: denester

### At this stop

The denester separates the bottom tray from the stack in its magazine and sets it into a fixed pocket on the indexing belt, in about 2.0 s. Every station downstream relies on that position. Operator 1 drops a new stack of about 250 trays (A) into the magazine from the supply aisle about every 75 min.

## Stop: grapes
title: Grape station
cargo: Tray and one grape bunch
cargo_detail: The bunch lies flat at the left end
station: grapes

### At this stop

A 4-axis delta robot takes one bunch from the next pocket of a pocket tray and lays it flat at the left end of the plate. Its soft silicone fingers close across the bunch and cradle it around its widest part, and it carries the bunch gently (1.0 m/s, 3 m/s²) so the grapes stay on the stem. A 3D camera imaged the pocket tray upstream, so the robot never waits for it. 3.30 s per plate.

## Stop: apples-a
title: Apple robot A
cargo: Grapes and 2 apple slices
cargo_detail: Slices 1-2 standing upright in a row
station: apples

### At this stop

Robot A, a hygienic six-axis arm, picks slices off the moving pick belt with an oval bellows suction cup on the flat cut face, and stands slices 1 and 2 upright in a row, tilting each about 75° as it places it. Belt tracking tells it where each slice is now, so it picks on the move. 5.87 s per plate for its 2 slices.

## Stop: apples-b
title: Apple robot B
cargo: Grapes and 4 apple slices
cargo_detail: Slices 3-4 lean on slices 1-2
station: apples

### At this stop

At the next stop, robot B places slices 3 and 4, leaning them on robot A's two. Both arms work at once, 5.87 s each, which makes the apple station the slowest on the line: it sets the line's step at 5.87 + 1.5 = 7.37 s. Slices nobody picks ride off the end of the pick belt into the return tote.

## Stop: crackers
title: Cracker station
cargo: Grapes, apples, 1 cracker pack
cargo_detail: The pack lies diagonally in the center
station: crackers

### At this stop

A fixed pick-and-place unit (two straight-line axes plus a twist, one suction cup) takes the bottom pack from the keyed gravity magazine and lays it diagonally in the center. Its place path comes down and away from the standing slices, with a slow last 10 mm. 1.80 s per plate.

## Stop: cheese-a
title: Cheese robot A
cargo: Bottom layer of cheese added
cargo_detail: 2 firm wedges
station: cheese

### At this stop

Robot A, a 4-axis delta with a vacuum cup approved for fatty food, places the bottom two wedges, both firm, from its two single-cheese trays. Each cheese has its own barcoded lane, so the robot always knows which cheese it holds without seeing it. 2.91 s per plate.

## Stop: cheese-b
title: Cheese robot B
cargo: Complete open plate
cargo_detail: A firm wedge and the brie on top
station: cheese

### At this stop

Robot B places the top two wedges: a firm wedge, then the brie with its own softer cup at lower vacuum (A), carried at half speed so it doesn't sag. Release height is set for each layer, because the top wedges rest partly on the cracker pack's slippery film. Robot B sets the cheese station's time at 3.90 s per plate.

## Stop: buffer
title: Accumulation conveyor
cargo: Complete open plate
cargo_detail: Queued nose to tail between stop gates
station: inspect-1

### At this stop

After cheese, the tray leaves the indexing belt for a short accumulation conveyor that keeps running, with trays queued nose to tail and held by stop gates. About 10 trays (A) cover about 2 min of a lidding stop at the normal pace, so the robots keep working through a short stop downstream. Fixed plates from Rework Table 1 rejoin here, ahead of the camera, so they get re-checked.

## Stop: inspect-1
title: Inspection before the lid
cargo: Checked open plate
cargo_detail: Counts, positions, rim, slice height
station: inspect-1

### At this stop

An overhead camera with controlled lighting, plus a height check, counts 1 bunch, 4 slices, 1 pack, and 4 wedges, checks positions, checks that nothing is over the rim, and checks that the slices sit below the lid's dome. About 1.5 s. A pusher at the next stop moves failures down a side lane to Rework Table 1, where Operator 2 fixes or scraps them.

## Stop: lidding
title: Lidding and coding
cargo: Lidded, coded plate
cargo_detail: Use-by date and lot code printed
station: lidding

### At this stop

A bought lidding machine separates a clear lid from its stack, sets it on the tray with 4 small suction cups, and presses until it snaps onto the rim, in 2.53 s. The coder then prints the use-by date and lot code as the tray moves out, so if an ingredient batch is recalled, only the affected plates get pulled.

## Stop: inspect-2
title: Inspection after the lid
cargo: Checked lidded plate
cargo_detail: Lid seated, code readable
station: inspect-2

### At this stop

A second overhead camera, with side lighting so a lifted lid edge casts a visible shadow, checks that the lid is present and centered, seated all the way round, and that the code is readable. About 1.5 s (A). A pusher sends failures to Rework Table 2.

## Stop: outfeed
title: Outfeed
cargo: In a 24-plate rack cart
cargo_detail: Ready for dispatch to the cold store
station: outfeed

### At this stop

The gantry's two jaws slide under the tray rim, never the lid, and lower the plate into its position in a 24-plate rack cart. It carries gently (1.0 m/s, 3 m/s²) so the standing slices don't tip inside the lid: 4.66 s on average. It fills one cart while Operator 2 swaps the other; at 200 plates/hr a cart fills every 7.2 min.

## Place: supply-aisle
title: Supply aisle

Every refill point faces this aisle and loads from outside the guard, so nobody opens a door during production. [Operator 1](#/person/operator-1) works here: about 11 refills an hour, one every 5.4 min, and about 50% busy at 200 plates/hr. Level sensors give about 10 min of warning before anything runs out (A).

- Tray denester: a stack of 250 fiber trays, lasts 75 min
- Grape destacker: a stack of 12 pocket trays (96 bunches), lasts 29 min
- Apple hopper: about 400 slices, lasts 30 min
- Cracker magazine: about 100 packs, lasts 30 min
- Cheese lanes (4): a stack of 20 single-cheese trays per lane, lasts 72 min per lane
- Lid magazine: a stack of 250 lids, lasts 75 min
- Coder: a label roll or ink, once per shift (A)

## Place: staging
title: Supply staging

Prep (the caterer's upstream kitchen) delivers everything to staging beside the supply aisle: tray stacks, pocket trays of portioned grape bunches, treated apple slices, cracker packs, single-cheese trays, and lid stacks. Cracker cases are opened outside the cold room, because cardboard sheds fibers and can't be washed, so only the packs come in. [Operator 1](#/person/operator-1) fetches from here and takes empty pocket and cheese trays to the wash, about 10 min an hour (A).

## Place: rework-1
title: Rework Table 1 (before the lid)

Plates that fail the [first inspection](#/ride/line/inspect-1) arrive here down a side lane, about 4 an hour (2%) (A). The screen shows the reason, for example "cheese count 3". [Operator 2](#/person/operator-2) adds or fixes the item and sets the plate back on the accumulation conveyor ahead of the camera, so it gets re-checked, or scraps it: dropped, touched a non-food surface, or can't be fixed in about a minute.

- A small chilled kit of each item: wedges of each cheese, slices, packs, and lids
- Gloves
- A rule that kit items come from the same lots the line is running, so the plate's printed code stays true

## Place: rework-2
title: Rework Table 2 (after the lid)

Plates that fail the [second inspection](#/ride/line/inspect-2) arrive here, about 2 an hour (1%) (A). [Operator 2](#/person/operator-2) reseats or replaces the lid, relabels a bad code, or scraps the plate if the contents are damaged, then sends it back ahead of the second camera.

## Place: cart-slots
title: Rack cart slots

Two slots beside the end of the line, each holding a rack cart of 24 plates in a 4 x 6 grid, about 800 x 850 mm (A). The gantry fills one cart while [Operator 2](#/person/operator-2) swaps the other. A light curtain guards each slot: breaking it keeps the gantry out of that slot, and the gantry keeps filling the other one (A). A sensor confirms the cart is in position before the gantry places. With two slots, Operator 2 has 7.2 min to swap before the second cart fills, and an alarm warns before that.

## Place: dispatch
title: Dispatch staging

[Operator 2](#/person/operator-2) rolls each full cart here, about 8 an hour, and rolls an empty one back into its slot. Dispatch collects full carts from staging and takes them to the cold store.

## Place: cabinet
title: Heated controller cabinet

All food-zone equipment is stainless, washdown-rated, and rated down to 0 C, and the room runs at 2-4 C. The robot controllers and gripper air controls sit in this heated cabinet outside the cold room, so they stay dry during the daily washdown. The robots need a warm-up run after a cold start or a washdown, because ABB requires one below 5 C; the [line technician](#/person/technician) runs it.

<!-- Stations: sections 1.1-1.9 of the design document, unchanged. -->

## Station: denester
title: 1.1 Tray denester
short: Tray denester

**Input**

- Molded fiber trays arrive from the supplier nested in stacks.
- Operator 1 drops a stack into the denester's magazine (the holder for the stack) from the supply
  aisle. About 250 trays (A) lasts about 75 min at 200 plates/hr.
- A level sensor warns before the magazine runs empty.

**Machine:** a standard food-line tray denester, stainless washdown version. It separates the bottom
tray from the stack and sets it into a fixed pocket on the indexing belt. Pneumatic models are rated up
to about 120 trays/min, so at 3.3 trays/min it runs at under 3% of capacity. The design question is
reliability with fiber trays, not speed.

**Time per plate:** about **2.0 s** to release one tray and seat it. This is conservative next to the
rated 0.5 s per tray.

**Output:** one empty tray, seated in a known position on the belt. Every station downstream relies on
that position.

**Top failure modes**

| Failure                            | Why                                         | How we handle it                                                                                                         |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Double feed: two trays drop as one | Nested fiber trays cling, more so when damp | Separator screws peel off one tray. A height sensor catches a double before release, and repeat failures raise an alarm  |
| Missed feed: no tray drops         | Warped rims, stuck stack                    | A tray-present sensor at the first position. Downstream robots skip the empty pocket instead of placing food on the belt |
| Tray crooked or off position       | Fiber rims vary                             | Belt pockets square the tray. This matters most at lidding, where a few mm off means a crushed lid                       |
| Magazine runs empty                |                                             | Level sensor alerts Operator 1 about 10 min ahead (A)                                                                    |

## Station: grapes
title: 1.2 Grapes (1 bunch per plate)
short: Grapes

**Input**

- Prep (the caterer's upstream kitchen) already portions every bunch by hand. Instead of dropping the
  bunches into a tote, they place each one in its own pocket of a reusable tray: 8 pockets per
  600 x 400 mm tray (A).
- Full trays arrive in stacks of 12, which is 96 bunches, about 29 min. Operator 1 loads a stack into a
  destacker from the supply aisle. The destacker holds two stacks, so loading never stops the line.
- The destacker releases one tray at a time onto a short conveyor. The conveyor carries the tray under a
  3D camera, which images it once. The camera confirms exactly one bunch per pocket and gives each
  bunch's position, angle, and height. The tray then stops under the robot.
- The robot takes one pocket per plate, so a tray serves 8 plates. Then the empty tray slides out to a
  stacker, and the next tray, already imaged and waiting, slides in.
- Operator 1 takes away the stack of empties when loading a full stack. Empties go to the tray wash and
  back to prep.

**Why pockets:** bunches tangle when they are loose, because the stems hook together. That makes bin
picking the least reliable pick on the line. Separating the bunches at the moment a person is already
holding each one costs almost nothing. Trays also let prep work in batches ahead of the line, instead
of keeping pace with it.

**Machine:** 1 x 4-axis delta robot (stainless, washdown), with soft silicone fingers in two facing rows.
The fingers close across the bunch and cradle it around its widest part. The bunch lies flat in its
pocket and goes straight down into the plate, so no tilt is needed, which is what a delta does well.

- **Rejected:** a bulk tote, 3D bin picking, and a six-axis arm. Bunches tangle, one pick drags out two,
  and bunches at the bottom get crushed.
- **Rejected:** pinching the stem. The bunch would hang from one point and swing.

**Time per plate (1 pick)**

| Part of the pick                                                                             | Time (s) |
| -------------------------------------------------------------------------------------------- | -------- |
| Crossing between pocket tray and plate (0.43 m average, each way)                            | 1.00     |
| Up and down moves                                                                            | 0.90     |
| Slow moves near the food (last 20 mm down, gentle set-down, finger clearance on the way out) | 0.60     |
| Fingers close and open                                                                       | 0.55     |
| Signals and settle                                                                           | 0.15     |
| Pick                                                                                         | 3.20     |
| Retries (3% of picks redone)                                                                 | 0.10     |
| **Station time**                                                                             | **3.30** |

While it holds a bunch, the robot is capped at 1.0 m/s and 3 m/s². At that acceleration, the loose lower
part of the bunch tilts only about 17° instead of swinging. The tray swap every 8 plates takes about 3 s
(A) and hides in time when the robot is away from the feeder tray.

**Output:** a tray with the grape bunch at the left end. Empty pocket trays go back to the wash loop.

**Top failure modes**

| Failure                                | Why                         | How we handle it                                                                                            |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tangled bunches, two lifted at once    | Stems hook together         | Pockets prevent it. The camera confirms one bunch per pocket                                                |
| Empty or double pocket                 | Prep error                  | The camera flags it, the robot skips that pocket, and the screen counts prep errors so they can be fed back |
| Grapes knocked off the stem            | Sudden moves                | Cradling grip and gentle acceleration. The station has spare time, so slow moves cost nothing               |
| Shiny wet grapes confuse the 3D camera | Glare washes out the image  | Multi-exposure capture. The camera sits upstream of the robot, so it costs no robot time                    |
| Prep can't adopt pocket trays          | This depends on the caterer | Fall back to tote bin picking with a six-axis arm. This is our first question for the caterer               |

## Station: apples
title: 1.3 Apples (4 slices per plate, standing upright and leaning)
short: Apples

**Input**

- Prepped slices arrive in bulk, drained and treated against browning by the caterer.
- Operator 1 tips them into a hopper from the supply aisle. The hopper holds about 30 min of slices,
  about 400 (A). It is kept small so cut fruit doesn't sit out long.
- A vibratory shaker spreads the slices into a single layer on a slow pick belt. The pick belt runs
  alongside the tray belt, past both robots.
- A 2D camera upstream finds single, flat slices and which side the skin is on. Belt tracking (an encoder
  counts how far the belt has moved since the camera saw each slice) tells the robot where each slice is
  now, so the robots pick on the move with no camera wait.
- Unpicked slices ride off the end into a return tote. Operator 1 tips them back into the hopper if
  they're still inside the caterer's time limit, and throws them out if not.

**Why a belt here, but pockets for grapes:** slices don't tangle, so a machine (the shaker) can separate
them. Laying out 800 slices an hour by hand would be four times the grape prep work.

**Machine:** 2 x six-axis arms (hygienic, washdown, rated down to 0 C), each with a food-grade oval
bellows suction cup that grips the slice's flat cut face. Robot A places slices 1-2. Robot B places
slices 3-4 at the next stop, leaning them on A's slices.

- **Why six-axis:** the slices stand upright and lean in a row, so each one has to be tilted about 75°
  as it's placed. A 4-axis delta keeps its tool level and can't do that.
- **Why two:** one arm would need 4 x 2.94 = 11.7 s of work per plate. That makes a 13.2 s step,
  just over the 13.1 s the line can afford with one apple robot (Section 3). It works out to about 198
  good plates/hr, just under target, with no margin for food handling nobody has measured yet.
- **Rejected:** a 5-axis delta. It can tilt, but it isn't rated for washdown.
- **Rejected:** a 4-axis delta. This becomes the right answer if the caterer lets the slices lie flat.

**Time per plate (per robot, 2 slices)**

| Part of the pick                                                                                    | Time (s) |
| --------------------------------------------------------------------------------------------------- | -------- |
| Crossing between pick belt and plate (0.5 m each way)                                               | 1.01     |
| Slow moves near the food (touch down on the slice, set it down leaning, pull straight off its face) | 0.70     |
| Up and down moves                                                                                   | 0.56     |
| Vacuum on and off (build up and confirm the grip, then release with a puff of air)                  | 0.28     |
| Signals, settle, and matching the belt's speed                                                      | 0.25     |
| Per slice                                                                                           | 2.80     |
| Retries (5%: wet slices stick together)                                                             | 0.14     |
| Per slice with retries                                                                              | 2.94     |
| **Station time: 2 slices per robot, both robots working at once**                                   | **5.87** |

- **Distance:** the 0.5 m comes from the belt layout: a 400 mm pick belt, a 150 mm gap, and a 250 mm
  tray belt (A).
- **Speed with a slice held:** capped at 1.0 m/s and 8 m/s², because the slice sways on the soft cup.
  Grip force is not the limit: the cup holds about 7x what the slice needs.
- **Tilt:** the wrist tilts the slice during the carry, so it adds no time.

**Output:** a tray with the grapes and 4 apple slices standing in a row. Unpicked slices go to the
return tote.

**Top failure modes**

| Failure                                     | Why                                                                  | How we handle it                                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two slices stuck together, or picked as one | Wet cut faces cling                                                  | The shaker separates them. The camera only targets single slices. A 5% retry allowance is built into the time                                                                                           |
| Slice slips off the cup                     | Wet and slippery                                                     | The cup goes on the flat cut face, never the skin. A vacuum switch confirms the grip before lifting, and acceleration is gentle. An inline filter keeps juice out of the vacuum line                    |
| Missed pick                                 |                                                                      | The slice rides on to robot B or the return tote, and the robot picks the next slice. A miss costs about 3 s. The 5% retry allowance already counts it, and the line has spare speed for it (Section 3) |
| Half-built row tips over                    | Robot A's two slices ride one belt step before robot B adds two more | A smooth start and stop on the belt. Option: place crackers before apples, so the slices lean into a slot between the grapes and the pack                                                               |
| Pick belt runs short                        | Hopper empty                                                         | A hopper level alarm to Operator 1. The belt deliberately carries more slices than the robots need                                                                                                      |

## Station: crackers
title: 1.4 Crackers (1 sealed pack per plate)
short: Crackers

**Input**

- Sealed 26 g packs come in cardboard cases. Operator 1 opens the cases outside the cold room, because
  cardboard sheds fibers and can't be washed, and brings in only the packs.
- The packs go into a gravity magazine: a vertical chute that holds a stack and feeds from the bottom.
  About 100 packs is about 30 min (A).
- The magazine is keyed so packs only fit printed side up, and a level sensor warns before it runs empty.

**Machine:** a fixed pick-and-place unit, not a robot. It has two straight-line axes plus a twist, and one
food-grade suction cup. An escapement (a gate that lets one pack through at a time) drops the bottom pack
onto a pick spot while the unit is placing the previous one.

- **Why:** every pack is identical, comes from the same spot, and goes to a tray stopped in a known
  position. Nothing varies, so a robot's flexibility and a camera add nothing.
- **Rejected:** a SCARA. It is worth it only if menu changes move the pack around often. It would save
  0.55 s at a station far from being the bottleneck.

**Time per plate (1 pick)**

| Part of the pick                                      | Time (s) |
| ----------------------------------------------------- | -------- |
| Crossing between magazine and plate (0.35 m each way) | 0.77     |
| Up and down moves                                     | 0.70     |
| Slow last 10 mm, beside the standing apple slices     | 0.10     |
| Vacuum on and off                                     | 0.11     |
| Signals                                               | 0.10     |
| Pick                                                  | 1.78     |
| Retries (1%)                                          | 0.02     |
| **Station time**                                      | **1.80** |

**Output:** a tray with grapes, apples, and the cracker pack lying diagonally in the center.

**Top failure modes**

| Failure                                | Why                                              | How we handle it                                                                                                                 |
| -------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Double feed: two packs come out as one | Film-wrapped packs cling (static, crimped edges) | A separator blade in the magazine. Inspection counts the packs                                                                   |
| Magazine jams                          | Crimped seal ends catch on the guides            | Guides sized to the seal edges. This is the station's main cause of stops, so its uptime depends on the magazine, not the picker |
| Knocking over the apple row            | The pack lands right beside the standing slices  | The place path comes down and away from the slices, with a slow last 10 mm                                                       |
| Pack above the rim                     | Placed off-center                                | Inspection checks rim clearance before the lid goes on                                                                           |

## Station: cheese
title: 1.5 Cheese (4 different wedges per plate, layered)
short: Cheese

**Input**

- Each of the four cheeses has its own lane. Wedges come in single-cheese trays of 400 x 300 mm, holding
  12 wedges in a 4 x 3 grid (A). Each lane stacks 20 trays, which is 240 wedges, about 72 min.
- Operator 1 loads stacks from the supply aisle. With four lanes, some lane needs a new stack about every
  18 min.
- Trays are colour-coded and barcoded per cheese, and scanned at the magazine, so the wrong cheese can't
  be loaded into a lane. Two of the four cheeses look alike to a camera, so this check can't rely on
  vision.
- A camera images each tray as it's presented, to confirm every wedge is there and find its angle. Empty
  trays go to a stacker and then the wash.

**Why one cheese per tray:** the robot always knows which cheese it is holding without having to see it.
This depends on how the wedges arrive, which is a caterer question. If the wedges are hand-cut, kitted
trays would also work: each row holds one plate's four wedges in placing order. Then one robot could do
the whole station.

**Machine:** 2 x 4-axis delta robots, with vacuum cups whose silicone is approved for fatty food. Brie
gets its own softer cup at lower vacuum (A).

- **The split:** layer order decides it. Robot A places the bottom two wedges, both firm. Robot B
  places the top two, a firm wedge and the brie, at the next stop.
- **Why delta:** wedges go down flat from above, partly stacked on each other. That needs up and down
  plus a twist, not a tilt.
- **Why two:** on time alone, one delta would manage all four wedges in 6.8 s. Cheese would then be
  the slowest station, at an 8.3 s step, and the line would still make about 315 good plates/hr. The
  problem is reach: four supply trays don't fit inside one delta's reach, which is about 1.1 m across.
  Two trays per robot do.
- **Rejected:** a six-axis arm, because no tilt is needed.
- **Rejected:** loose wedges spread by shakers, as for apples. Cheese clumps, and shaking smears the
  brie.

**Time per plate**

| Part of the pick                                  | Firm wedge (s) | Brie (s)                                                                        |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| Crossing between tray and plate (0.42 m each way) | 0.58           | 0.86 (carried at half speed so it doesn't sag)                                  |
| Slow moves near the food                          | 0.20           | 0.60 (slow touch, slow set-down, slow pull-away so it doesn't stick to the cup) |
| Up and down moves                                 | 0.33           | 0.46                                                                            |
| Vacuum on and off                                 | 0.16           | 0.25 (the rind leaks, and it needs a longer puff of air to let go)              |
| Signals and settle                                | 0.15           | 0.15                                                                            |
| Per wedge                                         | 1.43           | 2.32                                                                            |
| With retries (firm 2%, brie 5%)                   | 1.45           | 2.44                                                                            |

- Robot A, 2 firm wedges: 2 x 1.45 = 2.91 s
- Robot B, 1 firm wedge plus the brie: 1.45 + 2.44 = **3.90 s**, which sets the **station time**

**Output:** a complete open plate, ready for inspection. Empty cheese trays go to the wash.

**Top failure modes**

| Failure                                              | Why                                                         | How we handle it                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brie slips, sags, or deforms                         | Soft and sticky, and the rind seals poorly under a cup      | Its own cup, a slower and gentler pick, and extra time in the estimate. Test brie first in the vendor trial: it is the most likely thing to break the time estimate |
| Grip weakens over a shift                            | Fat builds up on the cups                                   | Wipe or swap the cups at breaks. Watch the vacuum level as an early warning                                                                                         |
| Two wedges stuck together, or separator paper picked | Cut faces cling, and suppliers may put paper between layers | A vacuum check on every pick. Ask how wedges are packed: the robot must never pick paper                                                                            |
| Wedge slides off the cracker pack past the rim       | The top wedges rest partly on slippery film                 | Release height set for each layer. Inspection checks rim clearance                                                                                                  |
| Wrong cheese in a lane                               | Operator loading error                                      | Barcoded, colour-coded trays, scanned at the magazine                                                                                                               |

## Station: inspect-1
title: 1.6 Inspection and reject (before the lid)
short: Inspection 1

**Input**

- The open, complete plate.
- **Re-entry point (A):** after the cheese station, the line switches from the indexing belt to a short
  accumulation conveyor. It keeps running, and trays queue on it nose to tail, held by stop gates.
  - It gives fixed plates from rework a place to rejoin anywhere ahead of the camera, so they get
    re-checked.
  - It is also a buffer. If lidding stops briefly, the robots keep working while trays queue. About 10
    trays (A) covers about 2 min of a lidding stop at the normal pace, or about 75 s at full speed
    (Section 3.6).
  - After cheese, trays move between stop gates on this conveyor. That hand-off is taken as the same
    1.5 s as a belt move (A).

**Machine:** an overhead camera with controlled lighting, in a washdown enclosure, plus a height check (a
3D or side-view camera). A pusher at the next stop moves failed plates into a side lane that ends at
Rework Table 1. The camera checks:

- counts: 1 bunch, 4 slices, 1 pack, 4 wedges
- positions
- nothing over the rim
- apple slices below the height of the lid's dome

**Why before the lid:**

- Fixes are cheap now: adding a wedge or nudging a slice takes seconds.
- It protects the lid press from crushing anything over the rim.
- An open tray also gives a clearer view, with no glare or condensation from the lid.

**Time per plate:** about **1.5 s** for the image and the pass or fail decision. The pusher works on the
previous plate at the same time.

**Output**

- Passing plates go on to lidding.
- Rejects go down the side lane to Rework Table 1. Its screen shows the reason, for example "cheese count
  3". Operator 2 fixes the plate and sets it back on the accumulation conveyor, or scraps it (dropped,
  touched a non-food surface, or can't be fixed quickly).
- Reject reasons are counted per station, so a station drifting out of spec shows up early.

**Top failure modes**

| Failure                 | Why                                           | How we handle it                                                                   |
| ----------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| False rejects           | Glare off wet fruit, condensation on the lens | Controlled lighting and an anti-fog window (A). Track the false-reject rate        |
| Wrong cheese not caught | Two cheeses look alike                        | Not a camera job: the barcoded lanes prevent it                                    |
| Reject lane backs up    | Operator 2 busy at the outfeed                | The lane holds several plates (A), and the screen raises an alarm before it's full |

## Station: lidding
title: 1.7 Lidding and coding
short: Lidding and coding

**Input**

- Clear snap-on lids arrive nested in stacks. Operator 1 loads the lid magazine from the supply aisle.
  About 250 lids (A) lasts about 75 min. A level sensor warns before it runs empty.
- Labels or ink for the coder.

**Machine:** one lidding machine, bought from a packaging supplier rather than built from a robot:

- **Lid denester:** separates the bottom lid from the stack.
- **Placer:** a fixed pick-and-place unit with 4 small suction cups that sets the lid on the tray.
- **Press:** pushes the lid down until it snaps onto the rim.

A coder then prints the use-by date and lot code on the lid or a label, for traceability: if an
ingredient batch is recalled, only the affected plates get pulled. It prints as the tray moves out
during the belt step, so it adds no station time (A).

**Why a bought machine:** it is the same lid in the same spot every time. That is standard packaging
equipment, and a robot would add nothing.

**Time per plate**

| Part of the cycle                                                  | Time (s) |
| ------------------------------------------------------------------ | -------- |
| Crossing between magazine and plate (0.35 m each way)              | 0.76     |
| Up and down moves                                                  | 0.69     |
| Peeling the lid off the stack, and a slow last 10 mm onto the tray | 0.30     |
| Pressing until it snaps                                            | 0.50     |
| Vacuum on and off                                                  | 0.15     |
| Signals                                                            | 0.10     |
| Cycle                                                              | 2.50     |
| Retries (1%)                                                       | 0.03     |
| **Station time**                                                   | **2.53** |

**Output:** a lidded, coded plate.

**Top failure modes**

| Failure                        | Why                                                    | How we handle it                                                                                          |
| ------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Press crushes the apple slices | The standing slices are the tallest thing on the plate | Inspection checks slice height before the lid. The lid's dome height is a caterer question                |
| Two lids picked, or none       | Nested clear lids cling (static, tight nest)           | Air blown between the lids, a vacuum check on every pick, and a thickness check for doubles               |
| Lid crushed or not snapped on  | Tray a few mm off position                             | The tray is held in its belt pocket. The press stroke is monitored: a short stroke means it hit something |
| Fiber rim crushed              | The press force is too high for a rim that varies      | A force-limited press, with a sensor confirming full travel                                               |
| Code smudged or missing        | Ink sticks poorly to cold, damp plastic                | A printed label instead of ink (A). The camera after lidding verifies the code                            |

## Station: inspect-2
title: 1.8 Inspection and reject (after the lid)
short: Inspection 2

**Input:** the lidded, coded plate.

**Machine:** an overhead camera with side lighting, so a lifted lid edge casts a visible shadow. It checks
three things:

- the lid is present and centered
- the lid is seated all the way round
- the code is present and readable

Failures are pushed into a side lane to Rework Table 2.

**Why:** the first inspection can't see what lidding does. Without this check, a missing, crooked, or
half-snapped lid ships to the airline.

**Time per plate:** about **1.5 s** (A). This camera could also sit at the coding stop; the throughput is
the same either way.

**Output**

- Good plates go on to the outfeed.
- Rejects go to Rework Table 2, where Operator 2 reseats or replaces the lid, relabels a bad code, or
  scraps the plate if the contents are damaged. Then the plate goes back ahead of this camera.

**Top failure modes**

| Failure         | Why                                          | How we handle it                                                 |
| --------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| False rejects   | Glare and condensation on a curved clear lid | Side lighting tuned for the lid edge, and an anti-fog window (A) |
| Unreadable code | A smudged print                              | Switch to labels. Relabel at Rework Table 2                      |

## Station: outfeed
title: 1.9 Outfeed
short: Outfeed

**Input**

- Finished, checked plates.
- Empty rack carts in two slots beside the end of the line. Each cart holds 24 plates in a 4 x 6 grid,
  about 800 x 850 mm (A). Operator 2 rolls the carts in and out.

**Machine:** a gantry (a robot on overhead rails), with two jaws that slide under the tray rim. It never
grips the lid, which could pop off. It fills one cart while Operator 2 swaps the other.

- A light curtain guards each slot. Breaking it keeps the gantry out of that slot, and the gantry keeps
  filling the other one (A).
- **Why 24-plate carts:** the first sizing, a 6-plate tray, filled every 1.8 min, so Operator 2 would
  swap 33 times an hour. A 24-plate cart cuts that to 8 swaps an hour. The cost is about 0.5 s more
  gantry travel per plate.
- **Why a gantry:** it places top-down into a rectangular area, and it is simple and rigid.
- **Rejected:** a six-axis arm. It is needed only if the trolley drawers are closed and plates have to
  slide in sideways. That is a caterer question.

**Time per plate (1 place)**

| Part of the cycle                                                 | Time (s) |
| ----------------------------------------------------------------- | -------- |
| Crossing between belt and cart position (1.1 m average, each way) | 2.47     |
| Up and down moves (rising 150 mm to clear the rack walls)         | 1.57     |
| Slow last 20 mm into the position                                 | 0.20     |
| Jaws close and open                                               | 0.30     |
| Signals                                                           | 0.10     |
| Cycle                                                             | 4.64     |
| Retries (0.5%)                                                    | 0.02     |
| **Station time (average)**                                        | **4.66** |

- **Gentle carry:** carrying a plate is capped at 1.0 m/s and 3 m/s², so the standing apple slices
  don't tip over inside the lid. That, plus the long move to the cart, is why the outfeed is the
  second-slowest station.
- **Farthest position:** the farthest cart position, about 1.6 m (A), takes about 5.5 s. That is still
  under the apple station's 5.87 s, so the outfeed never sets the line's pace.

**Output:** full rack carts of 24 plates. Operator 2 rolls them to the dispatch staging area for the
cold store. At 200 plates/hr a cart fills every 7.2 min.

**Top failure modes**

| Failure                                     | Why                               | How we handle it                                                                                                                                 |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full cart not swapped, so the line backs up | Operator 2 is busy at rework      | Two slots, so Operator 2 has 7.2 min to swap before the second cart fills. An alarm warns before that, and the accumulation conveyor is a buffer |
| Apples tip over inside the lid              | Hard starts or stops              | Gentle carry limits                                                                                                                              |
| Plate placed into a missing or crooked cart | The cart isn't seated in its slot | A sensor confirms the cart is in position before the gantry places                                                                               |
| Gantry can't reach into the trolley         | Closed drawers                    | Would need an arm instead. This is a caterer question                                                                                            |

<!-- People: sections 2.1-2.3 of the design document, unchanged. -->

## Person: operator-1
title: Operator 1
role: Supply
where: The supply aisle along the feeder side of the line, outside the guard

Every refill point faces the supply aisle and loads from outside the guard. Level sensors give about
10 min of warning before anything runs out (A).

| Refill point                                                                                            | What they load                                                                             | Lasts              | Refills per hour             | Minutes each (A) | Minutes per hour              |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------ | ---------------------------- | ---------------- | ----------------------------- |
| Tray denester                                                                                           | A stack of 250 fiber trays                                                                 | 75 min             | 0.8                          | 1.0              | 0.8                           |
| Grape destacker                                                                                         | A stack of 12 pocket trays (96 bunches), and take away the empty stack                     | 29 min             | 2.1                          | 1.5              | 3.1                           |
| Apple hopper                                                                                            | About 400 slices, and tip the return tote back in if it's within the time limit            | 30 min             | 2.0                          | 1.5              | 3.0                           |
| Cracker magazine                                                                                        | About 100 packs, unpacked from cases outside the cold room                                 | 30 min             | 2.0                          | 2.0              | 4.0                           |
| Cheese lanes (4)                                                                                        | A stack of 20 single-cheese trays per lane, barcode scanned, and take away the empty stack | 72 min per lane    | 3.3                          | 1.5              | 5.0                           |
| Lid magazine                                                                                            | A stack of 250 lids                                                                        | 75 min             | 0.8                          | 1.0              | 0.8                           |
| Coder                                                                                                   | A label roll or ink                                                                        | Once per shift (A) | -                            | -                | -                             |
| **Refills**                                                                                             |                                                                                            |                    | **11.0** (one every 5.4 min) |                  | **16.7**                      |
| Fetching supplies from the cold store and staging, and taking empty pocket and cheese trays to the wash |                                                                                            |                    |                              |                  | 10 (A)                        |
| Feeder alarms: an empty pocket, a double feed, a low-level warning                                      |                                                                                            |                    |                              |                  | 3 (A)                         |
| **Total**                                                                                               |                                                                                            |                    |                              |                  | **about 30 min/hr, 50% busy** |

**Why one supply operator is enough**

- **Slack:** at 50% busy, there's room for alarms, catch-up after stops, and refills that come due
  unevenly.
- **Short walks:** every refill point is on one aisle.
- **No pile-ups:** grapes, apples, and crackers all last about 30 min, so they would come due together.
  At shift start they are filled a few minutes apart, and the 10-minute level warnings let Operator 1
  work through anything that does line up, one at a time.
- **Short breaks:** the shortest-lasting supply (grapes, 29 min) outlasts a 15-minute break. Operator 1
  tops everything up before leaving, and nothing runs out.
- **Meal breaks:** Operator 2 covers refills during Operator 1's meal break, and the other way round
  (A). Their combined load is about 85% for those 30 minutes, which is fine for a short stretch.

**At full speed (about 356/hr):** Operator 1 rises to about 85% busy. That's fine for a
20-30 minute catch-up after a stop, but not for a whole shift. If the caterer wants the line run flat out,
for example to finish the shift early, add a second supply person or double the magazine sizes.

## Person: operator-2
title: Operator 2
role: Rework and outfeed
where: The line end, between the two rework tables and the two cart slots

| Task                                                                                                                                                                             | How often at 200/hr          | Minutes each (A) | Minutes per hour              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------- | ----------------------------- |
| Rack cart swap: roll the full cart out to dispatch staging and roll an empty one in. A light curtain guards the slot, and the gantry keeps filling the other slot                | Every 7.2 min (8.3 per hour) | 1.5              | 12.5                          |
| Rework Table 1 (before the lid): read the reject reason on the screen, add or fix the item, and set the plate back on the accumulation conveyor ahead of the camera, or scrap it | 4 per hour (2%)              | 1.0              | 4.0                           |
| Rework Table 2 (after the lid): reseat or replace the lid, or relabel, and send the plate back ahead of the second camera                                                        | 2 per hour (1%)              | 1.0              | 2.0                           |
| Watch reject trends and report a drifting station to the technician. Empty the scrap bin                                                                                         |                              |                  | 3 (A)                         |
| **Total**                                                                                                                                                                        |                              |                  | **about 22 min/hr, 35% busy** |

**What a rework table needs**

- **A small chilled kit of each item:** wedges of each cheese, slices, packs, and lids.
- **Gloves.**
- **A rule that kit items come from the same lots the line is running**, so the plate's printed code
  stays true.
- **When to scrap rather than fix:** a plate that was dropped, touched a non-food surface, or can't be
  fixed in about a minute. Food safety comes before saving one plate.

**Why Operator 2 is a separate person**

- **Combined load:** merged with Operator 1, one person would be about 85% busy at the target rate and
  over 100% during catch-up.
- **Two alarms at once:** one person can't answer a full cart and an empty cheese lane at the same time,
  and either one left waiting stops the line.
- **Fewer swaps:** the 24-plate carts are what keep Operator 2's load low. With 6-plate trays, there
  would be 33 swaps an hour on their own.

**At full speed (about 356/hr):** about 60% busy, with a cart swap about every 4 min. That's manageable.

## Person: technician
title: Line technician
role: Shared with other lines
where: On call, outside the cold room by the controller cabinet

- **Inside the guard:** clears anything inside the guard after locking out (locking the power off so
  nothing can start). Then restarts the robots after the fault.
- **Warm-up runs:** at shift start and after washdown, because the robots need one below 5 C.
- **Wear parts:** swaps the cheese robots' suction cups at breaks, because fat builds up, and changes
  the apple robots' juice filters.
- **Changeovers:** handles menu changes.
- **Why shared:** on a healthy line these calls come a few times a shift (A), so a dedicated technician
  would mostly wait. Keep one dedicated for the first weeks after commissioning, while faults are
  frequent (A).

<!-- Sections from the design document. -->

## Section: how-to-read
title: How to read the stations

- **Indexing belt.** Through the pick stations (1.1-1.5), trays ride an indexing belt: it moves every
  tray forward one position at once, then stops while every station works. Robots always place onto a
  still tray. After cheese, trays move onto a short accumulation conveyor (1.6).
- **Station order follows the layering on the plate.** Whatever sits underneath goes in first: grapes,
  then apples, then crackers, then cheese.
- **Times below are each station's work per plate.** The shared belt move (about 1.5 s, paid once per
  step by all stations together) and line uptime are added in Section 3.
- **How the times were estimated.** Each pick is split into steps: reach, grip, lift, carry, place,
  retreat. Each move is timed from its distance, using gentle food-handling speeds rather than catalog
  maximums, and checked against the robot makers' published benchmark cycles. Gripper times come from
  vendor data, and retries are added as a percentage. All of these are estimates to confirm in a vendor
  trial with real food at 3 C. Totals use unrounded step times, so a column can be off by 0.01 s.
  (A) marks an assumption.
- **Refills.** Every refill happens from the supply aisle, outside the guard, so nobody opens a door
  during production. Section 2 covers who does each refill and how often.
- **Cold and washdown.** All food-zone equipment is stainless, washdown-rated, and rated down to 0 C. The
  room runs at 2-4 C.
  - Robot controllers and gripper air controls sit in a heated cabinet outside the cold room.
  - The robots need a warm-up run after a cold start or a washdown, because ABB requires one below 5 C.
  - Washdown hardware is rated IP69K (hot high-pressure jets), not IP67 (immersion). We will get IP67
    confirmed in writing from each vendor.

## Section: roster
title: Who works the line

**In short:** two operators per shift, plus a technician shared with other lines.

- **Operator 1** runs the supply side and is about 50% busy at 200 plates/hr.
- **Operator 2** runs rework and the outfeed and is about 35% busy.
- Nobody works inside the guard during production.

**Basis for the numbers**

- **Rate:** in normal running, the line is paced to demand, 200 plates/hr (Section 3.6), and every
  interval below is at that rate. If it instead runs at full speed for a long stretch (about 356/hr
  after stops), things come due about 1.8x more often. That case is checked at the end of 2.1 and 2.2.
- **Task times:** minutes per task are estimates (A), to be confirmed with a time study during
  commissioning.
- **Reject rates:** 2% at the inspection before the lid, and 1% after it (A).

| Role                           | Where they stand                                                      | What they do                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Operator 1: supply             | The supply aisle along the feeder side of the line, outside the guard | Every refill. Brings supplies in, takes empties out, and responds first to feeder alarms                        |
| Operator 2: rework and outfeed | The line end, between the two rework tables and the two cart slots    | Swaps rack carts. Fixes or scraps rejects at both rework tables. Watches reject trends on the screen            |
| Line technician (shared)       | On call                                                               | Anything inside the guard: jams, robot faults and restarts, warm-up runs, gripper cup changes, menu changeovers |

The split follows where the line can fail. Operator 1 stands where the line can **starve** (a feeder runs
dry). Operator 2 stands where it can **block** (a full cart or a pile of rejects with nowhere to go). Each
person is next to the alarms they own.

### Not on the line roster

- **Prep kitchen (upstream):**
  - portions grapes into pocket trays, which adds about 1-2 s per bunch, about 5 min of labor per hour
  - cuts and treats apple slices
  - lays cheese into single-cheese trays
  - delivers everything to staging beside the supply aisle
- **Tray wash:** cleans pocket trays and cheese trays and returns them to prep.
- **Dispatch:** collects full rack carts from staging and takes them to the cold store.
- **Sanitation crew:** daily washdown.
- **QA:** checks the first plates at shift start, and samples plates during the shift.

## Section: shift
title: A shift, start to finish

1. **Start:** the technician runs the robots' warm-ups. Operator 1 fills every feeder, staggering the three 30-minute ones. QA checks the first plates.
2. **Running:** Operator 1 refills on level warnings, about every 5 min. Operator 2 swaps a cart every 7 min and works rejects as they arrive.
3. **Breaks:** top up before short breaks. Operators 1 and 2 cover each other's meal breaks.
4. **End:** run the feeders down and return unused cheese and slices to the cold store. The sanitation crew washes down. The controllers are outside the cold room, so they stay dry.

## Section: throughput
title: Throughput

**In short:** the line steps every **7.37 s**, a pace set by the apple station. That's 488 plates/hr while
it runs, about **356/hr made** after stops, and about **346 good plates/hr** even if every reject were
scrapped.

- **What's needed:** to net 200 good plates/hr, the line has to run at 283/hr while it's running, which
  is a 12.7 s step. We step in 7.37 s, so it has 1.7x the speed it needs.
- **How far uptime can fall:** the share of time the line is running (its uptime) could drop from the
  assumed 73% to 42% before output misses 200.
- **Normal running:** the line is paced to demand. Full speed is kept for catching up after a stop
  (3.6).

### 3.1 The target

- **Takt:** 200 plates/hr gives a budget of 3600 / 200 = **18 s per plate** (the takt time).
- **Picks:** each plate needs 10 picks (1 bunch, 4 slices, 1 pack, 4 wedges), which is 2,000 picks an
  hour. One robot doing everything would get 1.8 s per pick, with no time to change grippers. That's why
  each ingredient gets its own station.
- **Running speed:** the line has to run faster than 200/hr while it's running, because three kinds of
  error eat into output (3.2).

### 3.2 Error rates, and where each one is counted

| Error                                                  | Rate assumed                                                                          | Where it's counted                                                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Failed picks that get redone (retries)                 | Grapes 3%, apples 5%, crackers 1%, firm cheese 2%, brie 5%, lids 1%, outfeed 0.5% (A) | Inside each station's time in Section 1                                                                          |
| Stops: jams, double feeds, robot faults, empty feeders | Station uptimes of 93-99.5% (3.3)                                                     | Line uptime: **72.9%**                                                                                           |
| Rejects at inspection                                  | 2% before the lid, 1% after (A)                                                       | Good-plate yield: **97%**, as if every reject were scrapped. Most are fixed at rework, so this is the worst case |

### 3.3 Line uptime

On an indexing belt, any station stopping stops the whole line, so the station uptimes multiply together.

| Station                   | Uptime (A)  | Main cause of stops                                                                                                      |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tray denester             | 0.98        | Double or missed feeds                                                                                                   |
| Grape robot               | 0.93        | Bad picks. Kept at the figure for picking bunches from a tote; the pocket trays should do better, but no credit is taken |
| Grape tray feeder         | 0.99        | Destacker jams                                                                                                           |
| Apple robots (2)          | 0.97 x 0.97 | Slices stuck together, missed grips                                                                                      |
| Cracker unit              | 0.98        | Magazine jams on crimped pack ends                                                                                       |
| Cheese robots (2)         | 0.97 x 0.97 | Brie, fat on the cups                                                                                                    |
| Cheese tray lanes         | 0.98        | Four magazines and stackers                                                                                              |
| Inspection before the lid | 0.995       | Camera faults                                                                                                            |
| Lidding and coding        | 0.97        | Lids sticking together, press faults                                                                                     |
| Inspection after the lid  | 0.995       | Camera faults                                                                                                            |
| Outfeed                   | 0.99        | Cart not ready                                                                                                           |
| **Line**                  | **0.729**   | Product of all of the above                                                                                              |

**This is conservative in two ways:**

- It treats every stop as stopping the whole line. In fact the accumulation conveyor lets the pick
  stations keep working through a short stop at lidding, the second inspection, or the outfeed: about
  2 min at the normal pace.
- It takes no credit for the grape pocket trays.

**These uptimes are planning assumptions, not measurements.** They are the biggest unknown in this
section, and the first thing to replace with vendor data and trial runs.

### 3.4 The line's step time

Every station works while the belt is stopped. Then the whole belt moves every tray forward one
position, in about 1.5 s. So the line steps once per (slowest station's work + one belt move). The belt
move is paid once per step, shared by every station, not once per station.

| Station                   | Work per plate (s), from Section 1 | + belt move = cycle (s) |
| ------------------------- | ---------------------------------- | ----------------------- |
| Tray denester             | 2.00                               | 3.50                    |
| Grapes                    | 3.30                               | 4.80                    |
| **Apples (per robot)**    | **5.87**                           | **7.37**                |
| Crackers                  | 1.80                               | 3.30                    |
| Cheese (robot B)          | 3.90                               | 5.40                    |
| Inspection before the lid | 1.50                               | 3.00                    |
| Lidding and coding        | 2.53                               | 4.03                    |
| Inspection after the lid  | 1.50                               | 3.00                    |
| Outfeed (average)         | 4.66                               | 6.16                    |

- **The step:** 5.87 + 1.5 = **7.37 s**, set by the apple station. The next slowest are the outfeed
  (4.66 s of work) and cheese (3.90 s).
- **After cheese:** on the accumulation conveyor, the 1.5 s is the hand-off between stop gates rather
  than a belt move (A).
- **Time on the line:** one tray takes about 1.5 min from the denester to the cart at full speed, or
  about 2.5 min at the normal pace. That's how long a single plate takes to get through, not how often
  plates come off the end.

### 3.5 From step time to plates per hour

| Step                                      | Calculation | Result                 |
| ----------------------------------------- | ----------- | ---------------------- |
| Running nonstop                           | 3600 / 7.37 | 488 plates/hr          |
| After stops                               | 488 x 0.729 | **356 plates/hr made** |
| After rejects, if every one were scrapped | 356 x 0.97  | **346 good plates/hr** |

Most rejects are fixed at a rework table and rejoin the line. So real good output sits between 346 and 356.

### 3.6 Why we're confident the line clears 200, and how far past it

- **Needed while running:** 200 / (0.729 x 0.97) = **283 plates/hr**, which is a step of 3600 / 283 =
  **12.7 s**. At 7.37 s, the busiest robot uses 58% of that budget.
- **How far uptime can fall:** 200 / (488 x 0.97) = **42%**, against the 72.9% assumed.

**Stress test: one input changed at a time**

| Change                                                                                                                             | Step (s) | Good plates/hr |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------- |
| Base case                                                                                                                          | 7.37     | 346            |
| Line uptime 60% instead of 72.9%                                                                                                   | 7.37     | 284            |
| Belt move 2.5 s instead of 1.5 s                                                                                                   | 8.37     | 304            |
| Apple set-down 0.8 s instead of 0.3 s                                                                                              | 8.42     | 302            |
| Carrying a slice at 0.6 m/s and 4 m/s², instead of 1.0 m/s and 8 m/s²                                                              | 8.41     | 303            |
| Worst-case distances at every station                                                                                              | 7.84     | 325            |
| Everything pessimistic at once: worst distances, every food acceleration halved, gripper and settle times doubled, retries doubled | 11.15    | 228            |

- **Single changes:** every one stays above 280 good plates/hr.
- **Everything at once:** only when every assumption is wrong together does output fall to about 228,
  which still clears 200.

**What the spare capacity is for**

- **Normal pace:** demand is 200/hr, so in normal running the line is paced to about a 12.7 s step.
  That nets 200 good plates/hr after stops and rejects, and lets the robots run more gently. Section 2's
  staffing is sized for this pace.
- **Catch-up after stops:** after a stop, the line switches to full speed. A 10-minute stop leaves a
  backlog of 33 plates. With 346 - 200 = 146 plates/hr of spare capacity, it clears in about 14 min.
- **Running flat out instead:** the caterer could run at full speed all the time and finish the shift
  early. That needs more supply staffing (2.1).
- **Caveat:** if failures happen per pick rather than per hour, running faster could lower uptime. This
  model doesn't capture that.

### 3.7 What we would measure first

1. **Station uptimes.** Output moves one-for-one with line uptime, and these are still assumptions.
2. **Apple slice handling on real slices.** The set-down time and how fast a held slice can be carried are about a third of each apple pick.
3. **Brie at 3 C.** Does the rind seal under the cup, and does the wedge sag when it's moved?
