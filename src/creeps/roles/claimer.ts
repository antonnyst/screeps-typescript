import { Spawns } from "buildings";
import { unpackPosition } from "utils/RoomPositionPacker";
import { getEnergy, setMovementData } from "../creep";

export interface ClaimerMemory extends CreepMemory {
    room: string;
}

export function claimer(creep: Creep): void {
    const memory = creep.memory as ClaimerMemory;
    const c = Memory.rooms[memory.room].basicRoomData.controller;
    if (c === null) {
        return;
    }
    const cPos = unpackPosition(c);

    setMovementData(creep, {
        pos: cPos,
        range: 1
    });

    if (creep.room.name === memory.room) {
        const controller = creep.room.controller;
        if (controller !== undefined) {
            if (creep.pos.isNearTo(controller.pos)) {
                if (controller.reservation || (controller.owner !== undefined && !controller.my)) {
                    creep.attackController(controller);
                } else {
                    creep.claimController(controller);
                }
            }
        }
    }
}
