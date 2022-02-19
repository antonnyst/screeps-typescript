import { RoomData } from "data/room/room";
import { unpackPosition } from "utils/RoomPositionPacker";
import { setMovementData } from "../creep";

export interface ClaimerMemory extends CreepMemory {
    room: string;
    c?: number;
}

export function claimer(creep: Creep): void {
    const memory = creep.memory as ClaimerMemory;

    if (memory.c === undefined) {
        const basicRoomData = RoomData(memory.room).basicRoomData.get();
        if (basicRoomData === null) {
            RoomData(memory.room).basicRoomData.prepare();
            return;
        }
        if (basicRoomData.controller === null) {
            return;
        }
        memory.c = basicRoomData.controller;
    }

    const cPos = unpackPosition(memory.c);

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
