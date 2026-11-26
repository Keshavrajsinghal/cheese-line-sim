// Where everything on the floor sits: the single source of coordinates for the room, every
// station, the track, and the people. Drawing code only; no text.
//
// World meters: x grows toward the lower right of the screen, y toward the lower left, z up.
// The line runs along +y. Across it (x), from the back of the room to the front:
//   staging racks | supply aisle (Operator 1) | back guard | feeders | robots | tray belt |
//   front guard | ride track (raised) | rework tables, Operator 2 | track return | front wall |
//   warm corridor (controller cabinet, technician)
// Food and trays are drawn about 2.5x real size so they read at map zoom; machines are drawn at
// a matching scale, so distances here are drawing distances, not the plant's real dimensions.

export const ROOM = { x0: 0, x1: 21, y0: 0, y1: 56 }; // the cold room (2-4 C)
export const WARM = { x0: 21.4, x1: 25.4, y0: 6, y1: 34 }; // warm corridor outside the cold room
export const DOOR = { x: 21, y0: 15.4, y1: 17.2 }; // door from the warm corridor into the cold room

export const STAGING = { x0: 0.5, x1: 2.4, y0: 6, y1: 42 }; // supply staging racks along the back wall
export const AISLE = { x0: 2.8, x1: 5.6, y0: 2.6, y1: 46 }; // back supply aisle
export const HEAD_AISLE = { x0: 2.8, x1: 15.2, y0: 2.6, y1: 5.2 }; // aisle across the head of the line
export const GUARD = { back: 6.0, front: 12.9, head: 5.6, h: 1.85 }; // guard fence lines

export const LINE_X = 11.2; // tray belt centerline
export const BELT = [10.6, 11.8]; // tray belt frame, x
export const BELT_Z = 0.85; // belt surface height
export const HEADING = Math.PI / 2; // trays travel toward +y

// Indexing belt: rest positions (slots) PITCH apart. Every slot holds a tray.
export const PITCH = 1.8;
export const Y0 = 7.0; // slot 0, under the denester
export const slotY = (j) => Y0 + j * PITCH;
export const SLOT = { denester: 0, grapes: 2, "apples-a": 4, "apples-b": 5, crackers: 7, "cheese-a": 9, "cheese-b": 10 };
export const INDEX_END = slotY(10) + PITCH / 2; // end of the indexing belt (25.9)

// Accumulation conveyor: keeps running; trays queue nose to tail at stop gates.
export const ACC = { y0: INDEX_END, y1: 45.6, gap: 0.7 };
export const GATE = {
	buffer: 29.4, // middle of the queue
	"inspect-1": 34.0, // camera
	pusher1: 35.8, // pusher into the lane to Rework Table 1
	lidding: 38.2,
	coder: 40.0,
	"inspect-2": 41.8,
	pusher2: 43.6, // pusher into the lane to Rework Table 2
	outfeed: 45.2, // gantry pick point at the end of the conveyor
};
/** y of each ride stop (the tray position the stop is about). */
export const STOP_Y = {
	denester: slotY(SLOT.denester),
	grapes: slotY(SLOT.grapes),
	"apples-a": slotY(SLOT["apples-a"]),
	"apples-b": slotY(SLOT["apples-b"]),
	crackers: slotY(SLOT.crackers),
	"cheese-a": slotY(SLOT["cheese-a"]),
	"cheese-b": slotY(SLOT["cheese-b"]),
	buffer: GATE.buffer,
	"inspect-1": GATE["inspect-1"],
	lidding: GATE.lidding,
	"inspect-2": GATE["inspect-2"],
	outfeed: 49.6,
};

// Station footprints (inside the guard unless noted). Each station's feeder loads from the back
// guard line (x = GUARD.back), facing the supply aisle.
export const STATION = {
	denester: { x0: 9.6, x1: 12.8, y0: 5.6, y1: 8.4 }, // magazine loads from the head aisle
	grapes: { x0: 6.0, x1: 12.4, y0: 9.4, y1: 12.2, destacker: [6.0, 7.6], camera: 8.4, robot: [10.4, 10.6] },
	apples: { x0: 6.0, x1: 12.4, y0: 12.9, y1: 17.2, hopper: [6.0, 7.4], pickBelt: [9.4, 10.1], robotA: [9.0, 13.6], robotB: [9.0, 16.6], returnTote: [9.75, 17.6] }, // hopper and pickBelt are x ranges
	crackers: { x0: 6.0, x1: 12.4, y0: 18.6, y1: 20.6, magazine: [9.0, 19.6], unit: [10.2, 19.6] },
	cheese: { x0: 6.0, x1: 12.4, y0: 21.6, y1: 26.0, lanes: [21.9, 23.0, 24.1, 25.2], robotA: [10.3, 22.45], robotB: [10.3, 24.65] }, // each delta hangs between its two lanes
	accumulation: { x0: 10.6, x1: 11.8, y0: INDEX_END, y1: 45.6 },
	inspect1: { x0: 9.8, x1: 12.6, y0: 33.0, y1: 35.0 },
	lidding: { x0: 7.0, x1: 12.6, y0: 37.2, y1: 39.4, magazine: [7.6, 38.2] }, // lid magazine loads from the aisle
	coder: { x0: 10.0, x1: 12.6, y0: 39.5, y1: 40.5 },
	inspect2: { x0: 9.8, x1: 12.6, y0: 40.9, y1: 42.7 },
	outfeed: { x0: 8.6, x1: 13.2, y0: 44.4, y1: 53.2 }, // gantry frame over the belt end and both cart slots
};

// Reject lanes: from the pusher, through the front guard, to the rework tables.
export const LANES = [
	{ id: "rework-1", y: GATE.pusher1, x0: BELT[1], x1: 15.2 },
	{ id: "rework-2", y: GATE.pusher2, x0: BELT[1], x1: 15.2 },
];
/** Re-entry chutes through the front guard: fixed plates go back ahead of each camera. */
export const REENTRY = {
	"rework-1": { y: 32.4, x0: BELT[1], x1: 13.6 },
	"rework-2": { y: 40.9, x0: BELT[1], x1: 13.6 },
};
export const REWORK = {
	"rework-1": { x0: 15.2, x1: 16.8, y0: 34.9, y1: 36.7, screen: [16.8, 35.0] },
	"rework-2": { x0: 15.2, x1: 16.8, y0: 42.7, y1: 44.5, screen: [16.8, 42.8] },
};

// Rack carts: 24 plates in a 4 x 6 grid. Two slots past the end of the belt, opening to the front
// (Operator 2 rolls carts out toward +x, through each slot's light curtain).
export const CART_SLOTS = [
	{ id: "slot-1", x0: 9.0, x1: 12.4, y0: 46.4, y1: 49.4, curtain: 12.7 },
	{ id: "slot-2", x0: 9.0, x1: 12.4, y0: 49.9, y1: 52.9, curtain: 12.7 },
];
export const DISPATCH = { x0: 15.4, x1: 20.4, y0: 47.0, y1: 55.8 };

// Controller cabinet (heated, outside the cold room) and the technician's spot.
export const CABINET = { x0: 22.0, x1: 23.0, y0: 9.0, y1: 15.0 };

// People: standing posts and the points they walk between.
export const POSTS = {
	"operator-1": [4.2, 21.0],
	"operator-2": [17.8, 41.0],
	technician: [23.7, 13.5], // in front of the cabinet doors
};
/** Refill points along the supply aisle: where Operator 1 stands to load each feeder. */
export const REFILL = {
	denester: [11.0, 4.2],
	grapes: [4.6, 10.8],
	apples: [4.6, 13.8],
	crackers: [4.6, 19.6],
	"cheese-1": [4.6, STATION.cheese.lanes[0]],
	"cheese-2": [4.6, STATION.cheese.lanes[1]],
	"cheese-3": [4.6, STATION.cheese.lanes[2]],
	"cheese-4": [4.6, STATION.cheese.lanes[3]],
	lids: [4.6, 38.2],
	staging: [3.4, 24.0],
};

// The ride track: raised on columns along the front of the guard, out to the outfeed, then back
// along the front wall. Stops sit beside their station.
export const TRACK = { out: 14.2, back: 19.6, z: 2.6, y0: 2.0, y1: 55.2 };

/** Scene limits (projected px at zoom 1) that keep the camera over the plant. */
export const LIMITS = [-1950, -200, 1000, 1450];
