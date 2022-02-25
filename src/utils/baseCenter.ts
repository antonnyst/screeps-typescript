export function baseCenter(room: Room): RoomPosition {
  if (room.memory.genLayout === undefined) {
    return new RoomPosition(25, 25, room.name);
  }
  return new RoomPosition(room.memory.genLayout.prefabs[0].x, room.memory.genLayout.prefabs[0].y, room.name);
}
