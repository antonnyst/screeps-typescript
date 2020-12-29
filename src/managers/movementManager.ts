import { Manager } from "./manager";
import { getFromCache, saveToCache } from "../utils/Cache";
import * as Config from "../config/config";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { isPositionEdge, offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { describeRoom } from "utils/RoomCalc";
import { partial } from "lodash";

//  group creeps by rooms
//  loop by rooms
//      set all creeps current position and nextposition based on needs
//      put moving creeps in queue
//      proccess creeps
//          put creeps in the way in the queue for proccessing
//      when done move all creeps to their nextposition

export class MovementManager implements Manager {
    public run() {
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
                            if (creep.pos.isEqualTo(unpackPosition(creep.memory.movementData._path[0]))) {
                                creep.memory.movementData._path.shift();
                            }

                            data[creep.name] = {
                                needsToMove: true,
                                nextLocation: unpackPosition(creep.memory.movementData._path[0])
                            };
                            creepQueue.push(creep);
                        } else {
                            let partialTarget: RoomPosition | undefined = undefined;
                            if (creep.pos.roomName !== unpackPosition(creep.memory.movementData.targetPos).roomName) {
                                const route = Game.map.findRoute(
                                    creep.pos.roomName,
                                    unpackPosition(creep.memory.movementData.targetPos).roomName
                                );
                                if (route !== -2) {
                                    if (route.length > 3) {
                                        partialTarget = new RoomPosition(25, 25, route[1].room);
                                    }
                                }
                            }

                            const path = PathFinder.search(
                                creep.pos,
                                {
                                    pos:
                                        partialTarget === undefined
                                            ? unpackPosition(creep.memory.movementData.targetPos)
                                            : partialTarget,
                                    range: partialTarget === undefined ? creep.memory.movementData.range : 20
                                },
                                {
                                    flee: creep.memory.movementData.flee,
                                    roomCallback,
                                    swampCost: 10,
                                    plainCost: 2,
                                    maxOps: 5000,
                                    maxRooms: 32
                                }
                            ).path;

                            if (path.length === 0) {
                                creep.say("zero length path");
                                console.log("zero length path " + creep.name + " " + creep.pos);
                            }

                            creep.memory.movementData._path = [];
                            for (let i = 0; i < path.length; i++) {
                                creep.memory.movementData._path[i] = packPosition(path[i]);
                            }
                            data[creep.name] = {
                                needsToMove: true,
                                nextLocation: path[0]
                            };
                            creepQueue.push(creep);
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
                            } else {
                                data[creep.name].needsToMove = false;
                                data[creep.name].nextLocation = undefined;
                            }
                        } else {
                            occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] = creep;
                            if (
                                currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] !==
                                undefined
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
                                    unpackPosition(creep.memory.movementData._path[0]).isEqualTo(pos))
                            ) {
                                candidate = pos;
                                break;
                            }
                        }

                        potentialPositions.sort((a, b) => costMatrix.get(a.x, a.y) - costMatrix.get(b.x, b.y));

                        if (candidate === undefined) {
                            candidate = potentialPositions[0];
                        }

                        data[creep.name].nextLocation = candidate;

                        if (
                            creep.memory.movementData._path &&
                            creep.memory.movementData._path[0] !== packPosition(candidate)
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
                            creep.memory.movementData._path = undefined;
                            console.log(creep.name + " " + "fail move " + creep.pos + data[creep.name].nextLocation!);
                            creep.say("fail move");
                            continue;
                        }

                        if (data[creep.name].nextLocation !== undefined) {
                            creep.move(creep.pos.getDirectionTo(data[creep.name].nextLocation!));
                        }

                        creep.memory.movementData?._path?.shift();
                        if (creep.memory.movementData?._path?.length === 0) {
                            creep.memory.movementData._path = undefined;
                        }
                    }
                }
            }
        }
    }
}

const roomCallback = (roomName: string): boolean | CostMatrix => {
    const cache: CostMatrix | null = getFromCache("rccostmatrixfinal" + roomName, 0);
    if (cache !== null) {
        return cache;
    }

    if (describeRoom(roomName) === "source_keeper") {
        //return false;
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
