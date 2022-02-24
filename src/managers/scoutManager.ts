import { Observer } from "buildings";
import { RoomData } from "data/room/room";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { RunEvery } from "utils/RunEvery";
import { Manager } from "./manager";
import { describeRoom, OwnedRooms, RoomDescription } from "../utils/RoomCalc";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { DepositHarvesterMemory } from "creeps/roles";
import { bodySortingValues, GenerateBodyFromPattern, rolePatterns } from "utils/CreepBodyGenerator";

declare global {
    interface OwnedRoomMemory {
        scoutTargets?: string[];
    }
    interface Memory {
        mapRooms?: string;
        deposits?: Record<string, DepositData>;
    }
}
interface DepositData {
    pos: number;
    decayTime: number;
    lastCooldown: number;
    type: DepositConstant;
}

const SCOUT_RANGE: number = 8;
const DEFAULT_SCOUT_UPDATE_TIME = 10000;
const SCOUT_UPDATE_TIMES: Partial<Record<RoomDescription, number>> = {
    highway: 500,
    highway_portal: 500
};

const DEPOSIT_MAX_COOLDOWN = 100;
const DEPOSIT_MAX_RANGE = 3;

export class ScoutManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        RunEvery(
            () => {
                // Gather all owned rooms
                const ownedRooms: string[] = OwnedRooms().map((r) => r.name);

                // Gather all rooms and their closest owned room
                const rooms: string[][] = [];
                for (const room of ownedRooms) {
                    if ((Memory.rooms[room] as OwnedRoomMemory).scoutTargets === undefined) {
                        (Memory.rooms[room] as OwnedRoomMemory).scoutTargets = [];
                    }
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
                            if (otherRoom === null) {
                                continue;
                            }

                            const index = rooms.map((a) => a[0]).findIndex((a) => a === otherRoom);
                            if (index >= 0) {
                                const tRoom = rooms[index][1];

                                let tDist = Game.map.getRoomLinearDistance(otherRoom, tRoom);
                                if (Observer(Game.rooms[tRoom]) !== null && tDist <= OBSERVER_RANGE) {
                                    tDist = 0;
                                }

                                let oDist = Game.map.getRoomLinearDistance(otherRoom, room);
                                if (Observer(Game.rooms[room]) !== null && oDist <= OBSERVER_RANGE) {
                                    oDist = 0;
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

                const mapRooms = ([] as string[]).concat(ownedRooms);

                // Apply the pairs
                for (const roomPair of rooms) {
                    mapRooms.push(roomPair[0]);
                    if (
                        Game.time - (RoomData(roomPair[0]).lastUpdate.get() ?? 0) >
                        (SCOUT_UPDATE_TIMES[describeRoom(roomPair[0]) ?? "room"] ?? DEFAULT_SCOUT_UPDATE_TIME)
                    ) {
                        (Memory.rooms[roomPair[1]] as OwnedRoomMemory).scoutTargets!.push(roomPair[0]);
                    }
                }

                Memory.mapRooms = "";
                for (let i = 0; i < mapRooms.length; i++) {
                    Memory.mapRooms += mapRooms[i] + (i === mapRooms.length - 1 ? "" : ",");
                }
            },
            "scoutmanagerrun",
            500 / speed
        );

        // Deposit logic
        if (Memory.deposits === undefined) {
            Memory.deposits = {};
        }

        RunEvery(
            () => {
                for (const id in Memory.deposits) {
                    if (Memory.deposits[id]!.decayTime < Game.time && !hasHarvesters(id)) {
                        delete Memory.deposits[id];
                    } else if (Memory.deposits[id]!.lastCooldown <= DEPOSIT_MAX_COOLDOWN) {
                        // Lets check if we should spawn an harvester for this deposit
                        const pos = unpackPosition(Memory.deposits[id].pos);
                        const hostiles = RoomData(pos.roomName).hostiles.get();
                        if (!hasHarvesters(id) && (hostiles === null || hostiles.length === 0)) {
                            // Check range
                            const rooms = OwnedRooms().filter((r) => r.energyCapacityAvailable >= 3650);

                            const distances: [OwnedRoom, number][] = rooms.map((r) => {
                                const route = Game.map.findRoute(r.name, pos.roomName);
                                if (route === ERR_NO_PATH) {
                                    return [r, Infinity];
                                }
                                return [r, Object.keys(route).length];
                            });

                            if (_.some(distances, (d) => d[1] <= DEPOSIT_MAX_RANGE)) {
                                const closestRoom = distances.sort((a, b) => a[1] - b[1])[0];

                                if (closestRoom[0].memory.spawnQueue !== undefined) {
                                    closestRoom[0].memory.spawnQueue.push({
                                        body: GenerateBodyFromPattern(rolePatterns.depositHarvester, 3650).sort(
                                            (a, b) => bodySortingValues[a] - bodySortingValues[b]
                                        ),
                                        memory: {
                                            role: "depositHarvester",
                                            home: closestRoom[0].name,
                                            id
                                        } as DepositHarvesterMemory
                                    });
                                }
                            }
                        }
                    }
                }
            },
            "scoutmanagerdepositcheck",
            10 / speed
        );

        for (const room of Object.values(Game.rooms)) {
            const deposits = room.find(FIND_DEPOSITS);
            if (deposits.length > 0) {
                for (const deposit of deposits) {
                    Memory.deposits[deposit.id] = {
                        type: deposit.depositType,
                        pos: packPosition(deposit.pos),
                        decayTime: Game.time + deposit.ticksToDecay,
                        lastCooldown: deposit.lastCooldown
                    };
                }
            }
        }
    }
}

function hasHarvesters(id: string) {
    const spawned = _.some(
        Game.creeps,
        (c) => c.memory.role === "depositHarvester" && (c.memory as DepositHarvesterMemory).id === id
    );
    if (spawned) return true;

    const queued = _.some(OwnedRooms(), (r) =>
        _.some(
            r.memory.spawnQueue,
            (s) =>
                s.memory !== undefined &&
                s.memory.role === "depositHarvester" &&
                (s.memory as DepositHarvesterMemory).id === id
        )
    );

    return queued;
}
