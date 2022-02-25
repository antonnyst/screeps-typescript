/* eslint-disable */

// Undocumented functionality: might change at any moment without notice
// However, given its presence in the RoomPosition prototype, I doubt it'll happen anytime soon.

// RoomPositions have a hidden key `__packedPos` which holds an int unique to said pos.
// This int provides 1:1 mapping of RoomPosition<->int using the functions below.
// Storing the int instead of the serialized `pos` is a nice way to clean up memory, as stale `pos` objects in memory are no longer required.

// Create RoomPosition from int
export function unpackPosition(i?: number): RoomPosition {
  return newUnpackPosition(i!);
  // return Object.create(RoomPosition.prototype, { __packedPos: { value: i } });
}

// Retrieve hidden packed int
export function packPosition(pos: RoomPosition): number {
  return newPackPosition(pos);
  // return (new RoomPosition(pos.x, pos.y, pos.roomName) as any).__packedPos;
}

function newPackPosition(pos: RoomPosition): number {
  const xy = roomNameToXY(pos.roomName);
  xy[0] += kMaxWorldSize2;
  xy[1] += kMaxWorldSize2;
  if (
    xy[0] < 0 ||
    xy[0] > kMaxWorldSize ||
    xy[0] !== xy[0] ||
    xy[1] < 0 ||
    xy[1] > kMaxWorldSize ||
    xy[1] !== xy[1] ||
    pos.x < 0 ||
    pos.x > 49 ||
    pos.x !== pos.x ||
    pos.y < 0 ||
    pos.y > 49 ||
    pos.y !== pos.y
  ) {
    throw new Error("Invalid arguments in packPosition constructor");
  }
  return (xy[0] << 24) | (xy[1] << 16) | (pos.x << 8) | pos.y;
}
function newUnpackPosition(i: number): RoomPosition {
  const xy = [];
  xy[0] = ((i >>> 24) & 0xff) - kMaxWorldSize2;
  xy[1] = ((i >>> 16) & 0xff) - kMaxWorldSize2;
  const x = (i >>> 8) & 0xff;
  const y = i & 0xff;
  const roomName = getRoomNameFromXY(xy[0], xy[1]);
  return new RoomPosition(x, y, roomName);
}

function roomNameToXY(name: string) {
  let xx = parseInt(name.substr(1), 10);
  let verticalPos = 2;
  if (xx >= 100) {
    verticalPos = 4;
  } else if (xx >= 10) {
    verticalPos = 3;
  }
  let yy = parseInt(name.substr(verticalPos + 1), 10);
  const horizontalDir = name.charAt(0);
  const verticalDir = name.charAt(verticalPos);
  if (horizontalDir === "W" || horizontalDir === "w") {
    xx = -xx - 1;
  }
  if (verticalDir === "N" || verticalDir === "n") {
    yy = -yy - 1;
  }
  return [xx, yy];
}

function getRoomNameFromXY(x: number, y: number) {
  let xx = "";
  let yy = "";
  if (x < 0) {
    xx = "W" + (-x - 1);
  } else {
    xx = "E" + x;
  }
  if (y < 0) {
    yy = "N" + (-y - 1);
  } else {
    yy = "S" + y;
  }
  return "" + xx + yy;
}

const kMaxWorldSize = 256;
const kMaxWorldSize2 = kMaxWorldSize >> 1;
