import { setMovementData } from "creeps/creep";
import { unpackPosition } from "utils/RoomPositionPacker";
import { PLAYER_USERNAME } from "utils/username";

export interface ReserverMemory extends CreepMemory {
    room: string;
}

export function reserver(creep: Creep) {
    const memory = creep.memory as ReserverMemory;
    const controller = Memory.rooms[memory.room].basicRoomData.controller;
    if (controller === null) {
        return;
    }

    const pos = unpackPosition(controller);

    setMovementData(creep, {
        pos,
        range: 1
    });
    if (creep.pos.isNearTo(pos) && creep.room.controller !== undefined) {
        if (creep.room.controller.sign !== undefined) {
            creep.signController(creep.room.controller, "");
        }
        if (
            (creep.room.controller.reservation !== undefined &&
                creep.room.controller.reservation.username !==
                    Game.spawns[Object.keys(Game.spawns)[0]].owner.username) ||
            (creep.room.controller.owner !== undefined && creep.room.controller.owner.username !== PLAYER_USERNAME)
        ) {
            creep.attackController(creep.room.controller);
        } else {
            creep.reserveController(creep.room.controller);
        }
    }
}
