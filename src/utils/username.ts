let _username = "";
for (const name in Game.rooms) {
    const room = Game.rooms[name];
    if (room.controller !== undefined && room.controller.my && room.controller.owner !== undefined) {
        _username = room.controller.owner.username;
        break;
    }
}

export const PLAYER_USERNAME = _username;
