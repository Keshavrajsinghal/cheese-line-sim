# Decisions

Choices made where the process design did not say, with one line of reasoning each.

- A separate site and repository from RoboTycoon: it is the take-home artifact, so it shows only this line, and reviewers should not land in a larger personal learning site.
- Reuse RoboTycoon's drawing engine and UI shell (isometric canvas, ride runner, panel, route list, controls): it already handles phone and desktop, touch and mouse, and reduced motion.
- The station, people, and throughput text is the design document's text, unchanged (`content/line.md`); stop and map entries only restate it: the site must not drift from the submitted design.
- Food and trays are drawn about 2.5x real size and machines to match, so distances on the floor are drawing distances, not the plant's real dimensions: at true scale a plate is a few pixels at map zoom.
- Layout across the line, back to front: staging racks, supply aisle, back guard with a loading opening at every feeder, feeders, robots, tray belt, front guard, raised ride track, rework tables and Operator 2, then the warm corridor with the controller cabinet. The design puts every refill on one aisle outside the guard and Operator 2 at the line end between the rework tables and the cart slots.
- The denester is loaded from an aisle across the head of the line, joined to the supply aisle: it sits over the start of the belt, and the design has Operator 1 load it from the supply aisle.
- The ride track is raised and one-way: it passes over the reject lanes and Operator 2's area, and a return leg cluttered the view; "Ride again" returns the cart to the start.
- The line animates at the design's full-speed step (7.37 s: 5.87 s of apple work plus the 1.5 s belt move), not the normal demand-paced step (about 12.7 s): it shows the line's true capacity and keeps the motion lively. The throughput section explains both.
- Rejects are shown more often than the design's 2% and 1% (about 1 in 17 trays before the lid, 1 in 29 after): at the true rates a viewer would rarely see Operator 2 work a reject.
- Operator 1's refills are compressed into a loop of a few minutes: the design's 29-75 minute intervals would leave the supply side still for most of a visit. Each feeder's fill level falls between Operator 1's visits and jumps when they load it.
- Fixed plates rejoin the accumulation conveyor through a short re-entry chute in the front guard, ahead of each camera: the design has Operator 2 set them back ahead of the camera without opening a guard door.
- Full carts roll out of the front of each slot, through its light curtain, to dispatch staging at the end of the room; Operator 2 brings the spare empty cart back the same way.
- Every person wears a white coat, hairnet, gloves, and boots, plus a colored vest per role, so viewers can tell them apart.
