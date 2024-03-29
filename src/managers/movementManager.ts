/* eslint-disable no-underscore-dangle */
import { getFromCache, saveToCache } from "../utils/Cache";
import { isPositionEdge, offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { Manager } from "./manager";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";
import { describeRoom } from "utils/RoomCalc";
import { findRoute } from "pathfinding/findRoute";

declare global {
  interface CreepMemory {
    movementData?: MovementData;
  }
  interface Memory {
    cacheHits: number;
    totalQueries: number;
  }
}

export interface MovementData {
  targetPos: number;
  range: number;
  flee: boolean;
  heavy: boolean;
  _path?: string;
  _pathName?: string;
}

//  group creeps by rooms
//  loop by rooms
//      set all creeps current position and nextposition based on needs
//      put moving creeps in queue
//      proccess creeps
//          put creeps in the way in the queue for proccessing
//      when done move all creeps to their nextposition

// TODO: fix not removing path of length 1 when it fails

let cacheHits = 0;
let totalQueries = 0;

export class MovementManager implements Manager {
  public minSpeed = 0.1;
  public maxSpeed = 1;
  public run(speed: number): void {
    RunEvery(cleanPathCache, "movementmanagercleanpathcache", 9000 / speed, speed);

    const rooms = _.groupBy(Game.creeps, c => c.room.name);
    for (const room of Object.keys(rooms)) {
      const terrain = Game.rooms[room].getTerrain();

      const data: {
        [key in string]: {
          needsToMove: boolean;
          nextLocation?: RoomPosition;
        };
      } = {};
      /* eslint-disable @typescript-eslint/no-unsafe-return */
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const currentSpaces: Creep[][] = Array.from(Array(50), () => new Array(50));
      const occupiedSpaces: Creep[][] = Array.from(Array(50), () => new Array(50));
      /* eslint-enable @typescript-eslint/no-unsafe-return */
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */

      const creepQueue: Creep[] = [];

      for (const creep of rooms[room]) {
        currentSpaces[creep.pos.x][creep.pos.y] = creep;
        if (creep.memory.movementData) {
          let inRange =
            creep.pos.inRangeTo(
              unpackPosition(creep.memory.movementData.targetPos),
              creep.memory.movementData.range
            ) === !creep.memory.movementData.flee;
          if (isPositionEdge(creep.pos) && !creep.memory.movementData.flee) {
            inRange = false;
          }

          if (inRange || creep.fatigue > 0) {
            data[creep.name] = {
              needsToMove: false
            };
            if (
              (creep.memory.movementData.heavy && creep.memory.checkIdle && creep.memory.checkIdle.idleCount > 10) ||
              creep.fatigue > 0
            ) {
              occupiedSpaces[creep.pos.x][creep.pos.y] = creep;
            }
          } else {
            if (creep.memory.movementData._path) {
              if (creep.pos.isEqualTo(unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0], 10)))) {
                creep.memory.movementData._path = serializePath(
                  deserializePath(creep.memory.movementData._path).slice(1)
                );
              }

              data[creep.name] = {
                needsToMove: true,
                nextLocation: unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0], 10))
              };
              creepQueue.push(creep);
            } else {
              let partialTarget: RoomPosition | undefined;
              let pathing;
              if (creep.pos.roomName !== unpackPosition(creep.memory.movementData.targetPos).roomName) {
                const route = findRoute(
                  creep.pos.roomName,
                  unpackPosition(creep.memory.movementData.targetPos).roomName
                );
                if (route !== -2) {
                  if (route.length >= 2) {
                    partialTarget = new RoomPosition(25, 25, route[1].room);
                    pathing = [creep.pos.roomName, route[0].room, route[1].room];
                  } else if (route.length === 1) {
                    pathing = [creep.pos.roomName, route[0].room];
                  } else {
                    pathing = [creep.pos.roomName];
                  }
                }
              }

              const targetPos =
                partialTarget === undefined ? unpackPosition(creep.memory.movementData.targetPos) : partialTarget;

              const targetRange = partialTarget === undefined ? creep.memory.movementData.range : 23;

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

                const goals = [];
                if (targetRange <= 5 && !creep.memory.movementData.flee) {
                  for (let dx = -targetRange; dx <= targetRange; dx++) {
                    for (let dy = -targetRange; dy <= targetRange; dy++) {
                      const x = targetPos.x + dx;
                      const y = targetPos.y + dy;

                      if (x <= 0 || x >= 49 || y <= 0 || y >= 49 || terrain.get(x, y) === TERRAIN_MASK_WALL) {
                        continue;
                      }

                      goals.push(new RoomPosition(targetPos.x + dx, targetPos.y + dy, targetPos.roomName));
                    }
                  }
                }

                path = PathFinder.search(
                  creep.pos,
                  goals.length === 0
                    ? {
                        pos: targetPos,
                        range: targetRange
                      }
                    : goals,
                  {
                    flee: creep.memory.movementData.flee,
                    roomCallback: roomCallback(pathing),
                    swampCost: 10,
                    plainCost: 2,
                    maxOps: 20000,
                    maxRooms: creep.pos.roomName === targetPos.roomName ? 1 : 32
                  }
                ).path;

                if (path.length !== 0) {
                  for (let i = path.length - 1; i >= 1; i--) {
                    if (
                      (path[i].x === 0 || path[i].x === 49 || path[i].y === 0 || path[i].y === 49) &&
                      (path[i - 1].x === 0 || path[i - 1].x === 49 || path[i - 1].y === 0 || path[i - 1].y === 49)
                    ) {
                      path.splice(i, 1);
                    }
                  }

                  serializedPath = serializePath(path);
                  savePath(pathName, serializedPath);
                } else {
                  creep.say("zero length path");
                  console.log(`zero length path ${creep.name} ${JSON.stringify(creep.pos)}`);
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] !== undefined) {
              if (occupiedSpaces[creep.pos.x][creep.pos.y] !== undefined) {
                data[creep.name].nextLocation = undefined;
                data[creep.name].needsToMove = true;
                creepQueue.unshift(creep);
              } else if (
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y].memory.movementData
                  ?.heavy
              ) {
                data[creep.name].needsToMove = false;
                data[creep.name].nextLocation = undefined;
                creep.memory.movementData._path = undefined;
              } else if (
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y].memory
                  .movementData === undefined
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
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              occupiedSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] = creep;
              if (
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y] !== undefined &&
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                data[currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y].name] !==
                  undefined
              ) {
                data[
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y].name
                ].needsToMove = true;
                if (
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  data[currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y].name]
                    .nextLocation === undefined
                ) {
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  creepQueue.push(currentSpaces[data[creep.name].nextLocation!.x][data[creep.name].nextLocation!.y]);
                }
              }
            }
          } else {
            const potentialPositions: RoomPosition[] = [];
            const costMatrix = roomCallback(undefined)(room) as CostMatrix;
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
              console.log(`traffic jam ${JSON.stringify(creep.pos)}`);
              continue;
            }

            let candidate: RoomPosition | undefined;
            for (const pos of potentialPositions) {
              if (
                pos.getRangeTo(unpackPosition(creep.memory.movementData.targetPos)) <=
                  creep.memory.movementData.range ||
                (creep.memory.movementData._path &&
                  unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0], 10)).isEqualTo(pos))
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
              !unpackPosition(parseInt(creep.memory.movementData._path.split("_")[0], 10)).isEqualTo(candidate)
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (creep.pos.getRangeTo(data[creep.name].nextLocation!) !== 1 && creep.memory.movementData) {
              creep.say("fail move");
              creep.memory.movementData._path = undefined;

              if (creep.memory.movementData._pathName !== undefined) {
                removePath(creep.memory.movementData._pathName);
              }
              continue;
            }

            if (data[creep.name].nextLocation !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

function roomCallback(path: string[] | undefined) {
  return (roomName: string): boolean | CostMatrix => {
    if (path !== undefined && !path.includes(roomName)) {
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const cache: CostMatrix | null = getFromCache("rccostmatrixfinal" + roomName, 0);
    if (cache !== null) {
      return cache;
    }

    const room = Game.rooms[roomName];
    if (room === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const cachedLazyMatrix: CostMatrix | null = getFromCache("rccostmatrixlazy" + roomName, 10000);
      if (cachedLazyMatrix !== null) {
        return cachedLazyMatrix;
      }
      return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    let lazyMatrix: CostMatrix | null = getFromCache("rccostmatrixlazy" + roomName, 100);
    if (lazyMatrix === null) {
      lazyMatrix = new PathFinder.CostMatrix();
      const roads = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_ROAD
      });
      for (const road of roads) {
        lazyMatrix.set(road.pos.x, road.pos.y, 1);
      }
      const structures = room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType !== STRUCTURE_CONTAINER &&
          s.structureType !== STRUCTURE_ROAD &&
          (!(room.controller?.my && s.structureType === STRUCTURE_RAMPART) || s.structureType !== STRUCTURE_RAMPART)
      });
      for (const structure of structures) {
        lazyMatrix.set(structure.pos.x, structure.pos.y, 255);
      }
      const constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: cs =>
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
        const hostiles = RoomData(roomName).hostiles.get() ?? [];
        if (hostiles.length > 0) {
          for (const hostileData of hostiles) {
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
      if (describeRoom(roomName) === "highway_portal") {
        const portals = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } });
        for (const portal of portals) {
          lazyMatrix.set(portal.pos.x, portal.pos.y, 255);
        }
      }
      saveToCache("rccostmatrixlazy" + roomName, lazyMatrix);
    }
    const finalMatrix = lazyMatrix.clone();
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
}

const cacheTime = 500;

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
      result += `${packPosition(pos)}${i < path.length - 1 ? "_" : ""}`;
      currentRoom = pos.roomName;
    } else {
      result += path[i - 1].getDirectionTo(pos).toString() + (i < path.length - 1 ? "_" : "");
    }
  }
  return result;
}

function deserializePath(path: string): RoomPosition[] {
  const result: RoomPosition[] = [];
  if (path.length === 0) {
    return result;
  }
  const split: string[] = path.split("_");
  for (let i = 0; i < split.length; i++) {
    if (split[i].length > 1) {
      result[i] = unpackPosition(parseInt(split[i], 10));
    } else {
      result[i] = offsetPositionByDirection(result[i - 1], parseInt(split[i], 10) as DirectionConstant);
    }
  }
  return result;
}
