import { Observer } from "buildings";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { RunEvery } from "utils/RunEvery";
import { Manager } from "./manager";

declare global {
    interface RoomMemory {
        scoutTargets?: string[];
    }
}

const SCOUT_RANGE: number = 10;

export class ScoutManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        RunEvery(
            () => {
                //Gather all owned rooms
                const ownedRooms: string[] = [];
                for (const room of Object.keys(Memory.rooms)) {
                    if (Memory.rooms[room].roomLevel === 2) {
                        Memory.rooms[room].scoutTargets = [];
                        ownedRooms.push(room);
                    }
                }
                // Gather all rooms and their closest owned room
                const rooms: string[][] = [];
                for (const room of ownedRooms) {
                    const roomCoord = toRoomCoordinate(room);
                    if (roomCoord === null) {
                        continue;
                    }
                    for (let dx = -SCOUT_RANGE; dx <= SCOUT_RANGE; dx++) {
                        for (let dy = -SCOUT_RANGE; dy <= SCOUT_RANGE; dy++) {
                            const otherRoom = fromRoomCoordinate({
                                x: roomCoord.x + dx,
                                y: roomCoord.y + dy
                            });

                            const index = rooms.map((a) => a[0]).findIndex((a) => a === otherRoom);
                            if (index >= 0) {
                                const tRoom = rooms[index][1];

                                let tDist = Game.map.getRoomLinearDistance(otherRoom, tRoom);
                                if (Observer(Game.rooms[tRoom]) !== null && tDist <= OBSERVER_RANGE) {
                                    tDist = 0;
                                }

                                let oDist = Game.map.getRoomLinearDistance(otherRoom, room);
                                if (Observer(Game.rooms[room]) !== null && oDist <= OBSERVER_RANGE) {
                                    tDist = 0;
                                }

                                if (oDist < tDist) {
                                    rooms[index][1] = room;
                                }
                            } else {
                                rooms.push([otherRoom, room]);
                            }
                        }
                    }
                }

                // Apply the pairs
                for (const roomPair of rooms) {
                    if (
                        Memory.rooms[roomPair[0]] === undefined ||
                        // TODO: constant or more dynamic system
                        Game.time - Memory.rooms[roomPair[0]].lastUpdate > 10000
                    ) {
                        Memory.rooms[roomPair[1]]!.scoutTargets?.push(roomPair[0]);
                    }
                }
            },
            "scoutmanagerrun",
            500 / speed
        );
    }
}
