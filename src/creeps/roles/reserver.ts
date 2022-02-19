import { setMovementData } from "creeps/creep";
import { RoomData } from "data/room/room";
import { unpackPosition } from "utils/RoomPositionPacker";
import { PLAYER_USERNAME } from "utils/username";

export interface ReserverMemory extends CreepMemory {
    room: string;
    controllerPos?: number;
}

export function reserver(creep: Creep) {
    const memory = creep.memory as ReserverMemory;

    if (memory.controllerPos === undefined) {
        const basicRoomData = RoomData(memory.room).basicRoomData.get();
        if (basicRoomData === null) {
            RoomData(memory.room).basicRoomData.prepare();
            return;
        }
        if (basicRoomData.controller === null) {
            return;
        }
        memory.controllerPos = basicRoomData.controller;
    }

    const pos = unpackPosition(memory.controllerPos);

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
