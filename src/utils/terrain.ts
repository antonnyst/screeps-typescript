export function EmptySpaces(position: RoomPosition): number {
  const terrain = new Room.Terrain(position.roomName);
  let spaces = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (terrain.get(position.x + dx, position.y + dy) !== TERRAIN_MASK_WALL) {
        spaces += 1;
      }
    }
  }
  return spaces;
}
