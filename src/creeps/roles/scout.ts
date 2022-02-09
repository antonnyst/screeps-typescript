import { setMovementData } from "creeps/creep";
import { PLAYER_USERNAME } from "utils/username";

export interface ScoutMemory extends CreepMemory {
    room?: string;
}

export function scout(creep: Creep) {
    const memory = creep.memory as ScoutMemory;
    const home = Game.rooms[creep.memory.home];

    // Remove signs from owned rooms
    if (
        creep.room.controller !== undefined &&
        (creep.room.controller.my ||
            (creep.room.controller.reservation !== undefined &&
                creep.room.controller.reservation.username === PLAYER_USERNAME)) &&
        creep.room.controller.sign !== undefined
    ) {
        setMovementData(creep, {
            pos: creep.room.controller.pos,
            range: 1
        });
        if (creep.pos.isNearTo(creep.room.controller)) {
            creep.signController(creep.room.controller, "");
        }
        return;
    }

    // Find rooms to scout
    if (memory.room === undefined || memory.room === creep.room.name) {
        if (Memory.rooms[home.name].scoutTargets !== undefined && Memory.rooms[home.name].scoutTargets!.length > 0) {
            let closestRoom = undefined;
            let closestDistance = Infinity;
            for (const room of Memory.rooms[home.name].scoutTargets!) {
                let distance = Game.map.getRoomLinearDistance(creep.room.name, room);
                if (distance < closestDistance) {
                    closestRoom = room;
                    closestDistance = distance;
                }
            }

            if (closestRoom !== undefined) {
                memory.room = closestRoom;
            }
        }
    }

    // Move to target room
    if (memory.room !== undefined) {
        setMovementData(creep, {
            pos: new RoomPosition(25, 25, memory.room),
            range: 23
        });
    }
}
