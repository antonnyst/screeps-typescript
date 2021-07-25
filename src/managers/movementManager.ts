import { Manager } from "./manager";
import { getFromCache, saveToCache } from "../utils/Cache";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { isPositionEdge, offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { describeRoom } from "utils/RoomCalc";
import { RunEvery } from "utils/RunEvery";

//  group creeps by rooms
//  loop by rooms
//      set all creeps current position and nextposition based on needs
//      put moving creeps in queue
//      proccess creeps
//          put creeps in the way in the queue for proccessing
//      when done move all creeps to their nextposition

let cacheHits = 0;
let totalQueries = 0;

export class MovementManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        RunEvery(cleanPathCache, "movementmanagercleanpathcache", 9000 / speed, speed);

        const rooms = _.groupBy(Game.creeps, (c) => c.room.name);
        for (const room of Object.keys(rooms)) {
            const terrain = Game.rooms[room].getTerrain();

            let data: {
                [key in string]: {
                    needsToMove: boolean;
                    nextLocation?: RoomPosition;
                };
            } = {};
            let currentSpaces: Creep[][] = Array.from(Array(50), () => new Array(50));
            let occupiedSpaces: Creep[][] = Array.from(Array(50), () => new Array(50));

            let creepQueue: Creep[] = [];

            for (const creep of rooms[room]) {
                currentSpaces[creep.pos.x][creep.pos.y] = creep;
                if (creep.memory.movementData) {
                    if (
                        creep.pos.inRangeTo(
                            unpackPosition(creep.memory.movementData.targetPos),
                            creep.memory.movementData.range
                        ) === !creep.memory.movementData.flee ||
                        creep.fatigue > 0
                    ) {
                        data[creep.name] = {
                            needsToMove: false
                        };
                        if (
                            (creep.memory.movementData.heavy &&
                                creep.memory.checkIdle &&
                                creep.memory.checkIdle.idleCount > 10) ||
                            creep.fatigue > 0
                        ) {
                            occupiedSpaces[creep.pos.x][creep.pos.y] = creep;
                        }
                    } else {
                        if (creep.memory.movementData._path) {
                            if (
                                creep.pos.isEqualTo(
                                    unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0]))
                                )
                            ) {
                                creep.memory.movementData._path = serializePath(
                                    deserializePath(creep.memory.movementData._path).slice(1)
                                );
                            }

                            data[creep.name] = {
                                needsToMove: true,
                                nextLocation: unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0]))
                            };
                            creepQueue.push(creep);
                        } else {
                            let partialTarget: RoomPosition | undefined = undefined;
                            if (creep.pos.roomName !== unpackPosition(creep.memory.movementData.targetPos).roomName) {
                                const route = Game.map.findRoute(
                                    creep.pos.roomName,
                                    unpackPosition(creep.memory.movementData.targetPos).roomName,
                                    {
                                        routeCallback: (roomName, fromRoomName) => {
                                            if (Memory.rooms[roomName]?.roomLevel === -2) {
                                                return 25;
                                            }
                                            if (Memory.rooms[roomName]?.roomLevel === -1) {
                                                return 2;
                                            }
                                            if (describeRoom(roomName) === "source_keeper") {
                                                return 2;
                                            }

                                            return 1;
                                        }
                                    }
                                );
                                if (route !== -2) {
                                    if (route.length > 3) {
                                        partialTarget = new RoomPosition(25, 25, route[1].room);
                                    }
                                }
                            }

                            const targetPos =
                                partialTarget === undefined
                                    ? unpackPosition(creep.memory.movementData.targetPos)
                                    : partialTarget;

                            const targetRange = partialTarget === undefined ? creep.memory.movementData.range : 20;

                            const pathName =
                                "path_" +
                                packPosition(creep.pos).toString() +
                                "_" +
                                packPosition(targetPos).toString() +
                                "_" +
                                targetRange.toString() +
                                "_" +
                                (creep.memory.movementData.flee ? "1" : "0");

                            let serializedPath = getPath(pathName, speed);
                            let path: RoomPosition[] | undefined;

                            if (serializedPath === null) {
                                totalQueries++;
                                path = PathFinder.search(
                                    creep.pos,
                                    {
                                        pos: targetPos,
                                        range: targetRange
                                    },
                                    {
                                        flee: creep.memory.movementData.flee,
                                        roomCallback,
                                        swampCost: 10,
                                        plainCost: 2,
                                        maxOps: 20000,
                                        maxRooms: creep.pos.roomName === targetPos.roomName ? 1 : 32
                                    }
                                ).path;

                                if (path.length !== 0) {
                                    serializedPath = serializePath(path);
                                    savePath(pathName, serializedPath);
                                } else {
                                    creep.say("zero length path");
                                    console.log("zero length path " + creep.name + " " + creep.pos);
                                }
                            } else {
                                cacheHits++;
                                totalQueries++;
                                path = deserializePath(serializedPath);
                            }
                            if (serializedPath !== null) {
                                creep.memory.movementData._path = serializedPath;
                                creep.memory.movementData._pathName = pathName;
                                data[creep.name] = {
                                    needsToMove: true,
                                    nextLocation: path[0]
                                };
                                creepQueue.push(creep);
                            }
                        }
                    }
                } else {
                    occupiedSpaces[creep.pos.x][creep.pos.y] = creep;
                }
            }

            while (creepQueue.length > 0) {
                const creep = creepQueue.shift();
                if (creep === undefined) continue;
                if (creep.memory.movementData === undefined) continue;

                if (data[creep.name].needsToMove) {
                    if (data[creep.name].nextLocation) {
                        if (
                            occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] !==
                            undefined
                        ) {
                            if (occupiedSpaces[creep.pos.x][creep.pos.y] !== undefined) {
                                data[creep.name].nextLocation = undefined;
                                data[creep.name].needsToMove = true;
                                creepQueue.unshift(creep);
                            } else if (
                                occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y]
                                    .memory.movementData?.heavy
                            ) {
                                data[creep.name].needsToMove = false;
                                data[creep.name].nextLocation = undefined;
                                creep.memory.movementData._path = undefined;
                            } else if (
                                occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y]
                                    .memory.movementData === undefined
                            ) {
                                data[creep.name].needsToMove = false;
                                data[creep.name].nextLocation = undefined;
                                creep.memory.movementData._path = undefined;
                                if (creep.memory.movementData._pathName !== undefined) {
                                    removePath(creep.memory.movementData._pathName);
                                    console.log("removed path");
                                }
                            } else {
                                data[creep.name].needsToMove = false;
                                data[creep.name].nextLocation = undefined;
                            }
                        } else {
                            occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] = creep;
                            if (
                                currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] !==
                                    undefined &&
                                data[
                                    currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y]
                                        .name
                                ] !== undefined
                            ) {
                                data[
                                    currentSpaces[data[creep.name].nextLocation!.x][
                                        data[creep.name].nextLocation!.y
                                    ].name
                                ].needsToMove = true;
                                if (
                                    data[
                                        currentSpaces[data[creep.name].nextLocation!.x][
                                            data[creep.name].nextLocation!.y
                                        ].name
                                    ].nextLocation === undefined
                                ) {
                                    creepQueue.push(
                                        currentSpaces[data[creep.name].nextLocation!.x][
                                            data[creep.name].nextLocation!.y
                                        ]
                                    );
                                }
                            }
                        }
                    } else {
                        let potentialPositions: RoomPosition[] = [];
                        const costMatrix = roomCallback(room) as CostMatrix;
                        for (let dir = 1; dir <= 8; dir++) {
                            const pos = offsetPositionByDirection(creep.pos, dir as DirectionConstant);
                            if (
                                occupiedSpaces[pos.x][pos.y] === undefined &&
                                costMatrix.get &&
                                costMatrix.get(pos.x, pos.y) !== 255 &&
                                terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL &&
                                !isPositionEdge(pos)
                            ) {
                                potentialPositions.push(pos);
                            }
                        }
                        if (potentialPositions.length === 0) {
                            console.log("traffic jam " + creep.pos);
                            continue;
                        }

                        let candidate: RoomPosition | undefined = undefined;
                        for (const pos of potentialPositions) {
                            if (
                                pos.getRangeTo(unpackPosition(creep.memory.movementData.targetPos)) <=
                                    creep.memory.movementData.range ||
                                (creep.memory.movementData._path &&
                                    unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0])).isEqualTo(
                                        pos
                                    ))
                            ) {
                                candidate = pos;
                                break;
                            }
                        }

                        potentialPositions.sort((a, b) => {
                            let av = costMatrix.get(a.x, a.y);
                            let bv = costMatrix.get(b.x, b.y);
                            av = av === 0 ? terrain.get(a.x, a.y) * 5 : av;
                            bv = bv === 0 ? terrain.get(b.x, b.y) * 5 : bv;
                            return av - bv;
                        });

                        if (candidate === undefined) {
                            candidate = potentialPositions[0];
                        }

                        data[creep.name].nextLocation = candidate;

                        if (
                            creep.memory.movementData._path &&
                            !unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0])).isEqualTo(
                                candidate
                            )
                        ) {
                            creep.memory.movementData._path = undefined;
                        }

                        creepQueue.unshift(creep);
                    }
                }
            }

            for (const creep of rooms[room]) {
                if (data[creep.name] && data[creep.name].needsToMove && data[creep.name].nextLocation) {
                    if (creep.fatigue === 0) {
                        if (creep.pos.getRangeTo(data[creep.name].nextLocation!) !== 1 && creep.memory.movementData) {
                            console.log(creep.memory.movementData._path);
                            creep.memory.movementData._path = undefined;
                            console.log(creep.name + " " + "fail move " + creep.pos + data[creep.name].nextLocation!);
                            creep.say("fail move");
                            if (creep.memory.movementData._pathName !== undefined) {
                                removePath(creep.memory.movementData._pathName);
                                console.log("removed path");
                            }
                            continue;
                        }

                        if (data[creep.name].nextLocation !== undefined) {
                            creep.move(creep.pos.getDirectionTo(data[creep.name].nextLocation!));
                        }

                        if (creep.memory.movementData?._path) {
                            creep.memory.movementData._path = serializePath(
                                deserializePath(creep.memory.movementData._path).slice(1)
                            );
                        }

                        if (creep.memory.movementData?._path?.length === 0) {
                            creep.memory.movementData._path = undefined;
                        }
                    }
                }
            }
        }
        Memory.cacheHits = cacheHits;
        Memory.totalQueries = totalQueries;
    }
}

const roomCallback = (roomName: string): boolean | CostMatrix => {
    const cache: CostMatrix | null = getFromCache("rccostmatrixfinal" + roomName, 0);
    if (cache !== null) {
        return cache;
    }

    const room = Game.rooms[roomName];
    if (room === undefined) {
        const lazyMatrix: CostMatrix | null = getFromCache("rccostmatrixlazy" + roomName, 10000);
        if (lazyMatrix !== null) {
            return lazyMatrix;
        }
        return true;
    }
    let lazyMatrix: CostMatrix | null = getFromCache("rccostmatrixlazy" + roomName, 100);
    if (lazyMatrix === null) {
        lazyMatrix = new PathFinder.CostMatrix();
        const roads = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_ROAD
        });
        for (const road of roads) {
            lazyMatrix.set(road.pos.x, road.pos.y, 1);
        }
        const structures = room.find(FIND_STRUCTURES, {
            filter: (s) =>
                s.structureType !== STRUCTURE_CONTAINER &&
                s.structureType !== STRUCTURE_ROAD &&
                (!(room.controller?.my && s.structureType === STRUCTURE_RAMPART) ||
                    s.structureType !== STRUCTURE_RAMPART)
        });
        for (const structure of structures) {
            lazyMatrix.set(structure.pos.x, structure.pos.y, 255);
        }
        const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: (cs) =>
                cs.structureType !== STRUCTURE_CONTAINER &&
                cs.structureType !== STRUCTURE_ROAD &&
                cs.structureType !== STRUCTURE_RAMPART
        });
        for (const constructionSite of constructionSites) {
            if (
                constructionSite.structureType !== STRUCTURE_CONTAINER &&
                constructionSite.structureType !== STRUCTURE_ROAD &&
                (!(room.controller?.my && constructionSite.structureType === STRUCTURE_RAMPART) ||
                    constructionSite.structureType !== STRUCTURE_RAMPART)
            ) {
                lazyMatrix.set(constructionSite.pos.x, constructionSite.pos.y, 255);
            }
        }
        if (room.controller?.my && room.controller.level >= 5 && room.memory.genLayout !== undefined) {
            const cpos = new RoomPosition(
                room.memory.genLayout.prefabs[0].x,
                room.memory.genLayout.prefabs[0].y,
                room.name
            );
            lazyMatrix.set(cpos.x, cpos.y + 1, 255);
        }
        if (describeRoom(roomName) === "source_keeper") {
            /*if (Memory.rooms[roomName].ba.lairs !== undefined) {
                for (const lair of Memory.rooms[roomName].basicLayout.lairs!) {
                    const pos = unpackPosition(lair);
                    for (let dx = -3; dx <= 3; dx++) {
                        for (let dy = 0; dy <= 3; dy++) {
                            if (pos.x + dx < 0 || pos.x + dx > 49 || pos.y + dy < 0 || pos.y + dy > 49) {
                                continue;
                            }
                            lazyMatrix.set(pos.x + dx, pos.y + dy, 128);
                        }
                    }
                }
            }*/
            if (Object.keys(Memory.rooms[roomName].hostiles).length > 0) {
                for (const hostile in Memory.rooms[roomName].hostiles) {
                    const hostileData = Memory.rooms[roomName].hostiles[hostile];
                    const pos = new RoomPosition(hostileData.pos.x, hostileData.pos.y, hostileData.pos.roomName);
                    for (let dx = -3; dx <= 3; dx++) {
                        for (let dy = 0; dy <= 3; dy++) {
                            if (pos.x + dx < 0 || pos.x + dx > 49 || pos.y + dy < 0 || pos.y + dy > 49) {
                                continue;
                            }
                            if (lazyMatrix.get(pos.x + dx, pos.y + dy) < 128) {
                                lazyMatrix.set(pos.x + dx, pos.y + dy, 128);
                            }
                        }
                    }
                }
            }
        }
        saveToCache("rccostmatrixlazy" + roomName, lazyMatrix);
    }
    let finalMatrix = lazyMatrix.clone();
    const creeps = room.find(FIND_CREEPS);
    for (const creep of creeps) {
        if (
            !creep.my ||
            creep.memory.movementData === undefined ||
            (creep.memory.movementData.heavy && creep.memory.checkIdle && creep.memory.checkIdle.idleCount > 10)
        ) {
            finalMatrix.set(creep.pos.x, creep.pos.y, 255);
        }
    }
    saveToCache("rccostmatrixfinal" + roomName, finalMatrix);
    return finalMatrix;
};

const cacheTime = 6000;

const _pathCache: { [key in string]: { path: string; time: number } } = {};

function savePath(pathName: string, path: string): void {
    _pathCache[pathName] = {
        path,
        time: Game.time
    };
}

function getPath(pathName: string, speed: number): string | null {
    if (_pathCache[pathName] === undefined || _pathCache[pathName].time < Game.time - cacheTime / speed) {
        return null;
    }
    return _pathCache[pathName].path;
}

function removePath(pathName: string): void {
    delete _pathCache[pathName];
}

function cleanPathCache(speed: number): void {
    for (const pathName of Object.keys(_pathCache)) {
        if (_pathCache[pathName].time < Game.time - cacheTime / speed) {
            delete _pathCache[pathName];
        }
    }
}

function serializePath(path: RoomPosition[]): string {
    let result = "";
    if (path.length === 0) {
        return result;
    }
    let currentRoom = "";
    for (let i = 0; i < path.length; i++) {
        const pos = path[i];
        if (currentRoom !== pos.roomName) {
            result += packPosition(pos) + (i < path.length - 1 ? "_" : "");
            currentRoom = pos.roomName;
        } else {
            result += path[i - 1].getDirectionTo(pos).toString() + (i < path.length - 1 ? "_" : "");
        }
    }
    return result;
}

function deserializePath(path: string): RoomPosition[] {
    let result: RoomPosition[] = [];
    if (path.length === 0) {
        return result;
    }
    let split: string[] = path.split("_");
    for (let i = 0; i < split.length; i++) {
        if (split[i].length > 1) {
            result[i] = unpackPosition(parseInt(split[i]));
        } else {
            result[i] = offsetPositionByDirection(result[i - 1], parseInt(split[i]) as DirectionConstant);
        }
    }
    return result;
}
