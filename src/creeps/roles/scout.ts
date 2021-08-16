import { setMovementData } from "creeps/creep";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";

export interface ScoutMemory extends CreepMemory {
    room?: string;
}

const SCOUT_RANGE = 8;

export function scout(creep: Creep) {
    const memory = creep.memory as ScoutMemory;
    const home = Game.rooms[creep.memory.home];

    if (memory.room === undefined || memory.room === creep.room.name) {
        let found = false;
        let leastUpdatedRoom: string | null = null;
        let leastUpdatedValue: number = Infinity;

        const roomCoord = toRoomCoordinate(home.name);
        if (roomCoord === null) {
            return;
        }

        for (let dx = -SCOUT_RANGE; dx <= SCOUT_RANGE; dx++) {
            if (found) {
                break;
            }
            for (let dy = -SCOUT_RANGE; dy <= SCOUT_RANGE; dy++) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const room = fromRoomCoordinate({
                    x: roomCoord.x + dx,
                    y: roomCoord.y + dy
                });
                if (Memory.rooms[room] === undefined) {
                    memory.room = room;
                    found = true;
                    break;
                } else {
                    const route = Game.map.findRoute(creep.room.name, room);
                    if (route !== -2 && route.length * 50 > creep.ticksToLive!) {
                        if (leastUpdatedRoom === null || Memory.rooms[room].lastUpdate < leastUpdatedValue) {
                            leastUpdatedRoom = room;
                            leastUpdatedValue = Memory.rooms[room].lastUpdate;
                        }
                    }
                }
            }
        }

        if (!found && leastUpdatedRoom !== null) {
            memory.room = leastUpdatedRoom;
        }
    } else {
        setMovementData(creep, {
            pos: new RoomPosition(25, 25, memory.room),
            range: 23
        });
    }
}