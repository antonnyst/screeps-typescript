import { setMovementData } from "creeps/creep";
import { describeRoom } from "utils/RoomCalc";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { PLAYER_USERNAME } from "utils/username";

export interface ScoutMemory extends CreepMemory {
    room?: string;
}

const SCOUT_RANGE = 8;

export function scout(creep: Creep) {
    const memory = creep.memory as ScoutMemory;
    const home = Game.rooms[creep.memory.home];
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
    } else if (memory.room === undefined || memory.room === creep.room.name) {
        let leastUpdatedRoom: string | null = null;
        let leastUpdatedValue: number = Infinity;
        let leastUpdatedDistance: number = Infinity;

        const roomCoord = toRoomCoordinate(home.name);
        if (roomCoord === null) {
            return;
        }

        for (let dx = -SCOUT_RANGE; dx <= SCOUT_RANGE; dx++) {
            for (let dy = -SCOUT_RANGE; dy <= SCOUT_RANGE; dy++) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const room = fromRoomCoordinate({
                    x: roomCoord.x + dx,
                    y: roomCoord.y + dy
                });
                const route = Game.map.findRoute(creep.room.name, room, {
                    routeCallback: (roomName, fromRoomName) => {
                        if (Memory.rooms[roomName] !== undefined) {
                            if (Memory.rooms[roomName].roomLevel === -2) {
                                return 25;
                            }
                            if (Memory.rooms[roomName].roomLevel === -1) {
                                return 5;
                            }
                        }
                        if (describeRoom(roomName) === "source_keeper") {
                            return 5;
                        }
                        return 1;
                    }
                });
                if (route === -2 || route.length * 50 > creep.ticksToLive!) {
                    continue;
                }
                let dangerous = false;
                for (const room of route) {
                    if (Memory.rooms[room.room] !== undefined && Memory.rooms[room.room].roomLevel === -2) {
                        dangerous = true;
                        break;
                    }
                }
                if (dangerous) {
                    continue;
                }
                if (
                    Memory.rooms[room] === undefined &&
                    (leastUpdatedRoom === null || route.length < leastUpdatedDistance)
                ) {
                    leastUpdatedRoom = room;
                    leastUpdatedValue = 0;
                    leastUpdatedDistance = route.length;
                } else if (Memory.rooms[room] !== undefined) {
                    if (leastUpdatedRoom === null || Memory.rooms[room].lastUpdate < leastUpdatedValue) {
                        leastUpdatedRoom = room;
                        leastUpdatedValue = Memory.rooms[room].lastUpdate;
                        leastUpdatedDistance = route.length;
                    }
                }
            }
        }
        if (leastUpdatedRoom !== null) {
            memory.room = leastUpdatedRoom;
        }
    } else {
        setMovementData(creep, {
            pos: new RoomPosition(25, 25, memory.room),
            range: 23
        });
    }
}
