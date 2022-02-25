let username = "";
for (const name in Game.rooms) {
  const room = Game.rooms[name];
  if (room.controller !== undefined && room.controller.my && room.controller.owner !== undefined) {
    username = room.controller.owner.username;
    break;
  }
}

export const PLAYER_USERNAME = username;
