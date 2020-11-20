// Undocumented functionality: might change at any moment without notice
// However, given its presence in the RoomPosition prototype, I doubt it'll happen anytime soon.

// RoomPositions have a hidden key `__packedPos` which holds an int unique to said pos.
// This int provides 1:1 mapping of RoomPosition<->int using the functions below.
// Storing the int instead of the serialized `pos` is a nice way to clean up memory, as stale `pos` objects in memory are no longer required.

// Create RoomPosition from int
export function unpackPosition(i?: number): RoomPosition {
    return Object.create(RoomPosition.prototype, { __packedPos: { value: i } });
}

// Retrieve hidden packed int
export function packPosition(pos: RoomPosition): number {
    return (new RoomPosition(pos.x, pos.y, pos.roomName) as any).__packedPos;
}
