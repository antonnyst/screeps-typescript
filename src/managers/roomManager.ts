import { Manager } from "./manager";
import { ConstructionHandler } from "./roomManager/constructionHandler";
import { RepairHandler } from "./roomManager/repairHandler";
import { LayoutHandler } from "./roomManager/layoutHandler";
import { LinkHandler } from "./roomManager/linkHandler";
import { LabHandler } from "./roomManager/labHandler";
import { ResourceHandler } from "./roomManager/resourceHandler";
import { RunEvery, RunNow } from "utils/RunEvery";
import { VisualHandler } from "./roomManager/visualHandler";
import { BasicRoomData, generateBasicRoomData } from "layout/layout";
import { RemoteHandler } from "./roomManager/remoteHandler";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { describeRoom } from "utils/RoomCalc";
import { Observer } from "buildings";

declare global {
    interface RoomMemory {
        roomLevel: number;
        reservation: ReservationDefinition | undefined;
        basicRoomData: BasicRoomData;
        hostiles: { [key: string]: HostileData };
        remotes: string[];
        remoteSupportRooms: string[];
        targetRemoteCount?: number;
        lastUpdate: number;
    }
}

interface HostileData {
    id: string;
    pos: RoomPosition;
    body: BodyPartDefinition[];
    firstSeen: number;
}

export class RoomManager implements Manager {
    minSpeed = 0.2;
    maxSpeed = 1;
    run(speed: number) {
        for (const room in Game.rooms) {
            roomLogic(room, speed);
        }
    }
}

function roomLogic(roomName: string, speed: number): void {
    const room: Room = Game.rooms[roomName];

    //Update room level
    if (room.memory.roomLevel === undefined) {
        RunNow(() => {
            room.memory.roomLevel = getRoomLevel(room);
            room.memory.lastUpdate = Game.time;
        }, "roomlogicupdateroomlevel" + roomName);
    }

    RunEvery(
        () => {
            room.memory.roomLevel = getRoomLevel(room);
            room.memory.lastUpdate = Game.time;
        },
        "roomlogicupdateroomlevel" + roomName,
        10 / speed
    );

    if (room.memory.roomLevel === 2 && room.memory.remoteSupportRooms === undefined) {
        room.memory.remoteSupportRooms = [];
    }

    //Update room hostiles
    RunEvery(updateRoomHostiles, "roomlogicupdateroomhostiles" + roomName, 3 / speed, room);

    //Get basic room data
    RunEvery(
        () => {
            if (room.memory.basicRoomData === undefined) {
                room.memory.basicRoomData = generateBasicRoomData(room);
            }
        },
        "roomlogicgeneratebasicroomdata" + roomName,
        100 / speed
    );

    // Observer logic
    if (room.memory.roomLevel === 2 && Observer(room) !== null) {
        if (room.memory.scoutTargets !== undefined && room.memory.scoutTargets.length > 0) {
            const obt = room.memory.scoutTargets.shift()!;
            Observer(room)!.observeRoom(obt);
            console.log(room + " observing " + obt);
        }
    }

    //Update room reservation
    RunEvery(
        () => {
            if (room.memory.reservation !== undefined || room.memory.roomLevel === -1 || room.memory.roomLevel === 1) {
                updateRoomReservation(room);
            }
        },
        "roomlogicupdateroomreservation" + roomName,
        5 / speed
    );

    //ResourceHandler
    RunEvery(ResourceHandler, "roomlogicresourcehandler" + roomName, 5 / speed, room);

    //LayoutHandler
    RunEvery(LayoutHandler, "roomlogiclayouthandler" + roomName, 10 / speed, room, speed);

    //LabHandler
    RunEvery(LabHandler, "roomlogiclabhandler" + roomName, 5 / speed, room);

    //ConstructionHandler
    RunEvery(ConstructionHandler, "roomlogicconstructionhandler" + roomName, 5 / speed, room);

    //RepairHandler
    RunEvery(RepairHandler, "roomlogicrepairhandler" + roomName, 5 / speed, room);

    //LinkHandler
    RunEvery(LinkHandler, "roomlogiclinkhandler" + roomName, 4 / speed, room);

    //VisualHandler
    VisualHandler(room, speed);

    //RemoteHandler
    RunEvery(RemoteHandler, "roomlogicremotehandler" + roomName, 250 / speed, room);

    //RemoteDecisions
    RunEvery(
        () => {
            remoteDecisions(room);
        },
        "roomlogicremotedecisions" + roomName,
        250 / speed,
        room
    );
}

function getRoomLevel(room: Room): number {
    if (room.controller === undefined) {
        return 0;
    }
    if (room.controller.my) {
        return 2;
    }
    const hasOwnStructures: boolean = room.find(FIND_MY_STRUCTURES).length > 0 ? true : false;
    if (hasOwnStructures) {
        return 2;
    }
    if (
        room.controller.owner !== undefined &&
        room.controller.owner.username !== Game.spawns[Object.keys(Game.spawns)[0]].owner.username
    ) {
        return -2;
    }
    const reservation: ReservationDefinition | undefined = room.controller.reservation;
    if (reservation === undefined) {
        return 0;
    }
    if (reservation.username === Game.spawns[Object.keys(Game.spawns)[0]].owner.username) {
        return 1;
    } else {
        return -1;
    }
}
function updateRoomHostiles(room: Room): void {
    const hostiles: Creep[] = room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length === 0) {
        room.memory.hostiles = {};
        return;
    }
    if (room.memory.hostiles === undefined) {
        room.memory.hostiles = {};
    }
    const newHostiles: { [key: string]: HostileData } = {};
    for (const creep of hostiles) {
        if (room.memory.hostiles[creep.id] !== undefined) {
            newHostiles[creep.id] = room.memory.hostiles[creep.id];
        } else {
            if (
                room.memory.roomLevel === 2 ||
                creep.getActiveBodyparts(ATTACK) > 0 ||
                creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
                creep.getActiveBodyparts(CLAIM) > 0 ||
                creep.getActiveBodyparts(CARRY) > 0 ||
                creep.getActiveBodyparts(WORK) > 0 ||
                creep.getActiveBodyparts(HEAL) > 0
            ) {
                newHostiles[creep.id] = {
                    id: creep.id,
                    pos: creep.pos,
                    body: creep.body,
                    firstSeen: Game.time
                };
            }
        }
    }
    room.memory.hostiles = newHostiles;
}
function updateRoomReservation(room: Room): void {
    room.memory.reservation = room.controller?.reservation;
}
const REMOTE_SEARCH_RANGE = 2;

function remoteDecisions(room: Room): void {
    if (room.memory.roomLevel !== 2) {
        return;
    }
    const roomCoord = toRoomCoordinate(room.name);
    if (roomCoord === null || room.memory.remotes === undefined) {
        return;
    }
    const currentCount = room.memory.remotes.length;
    if (currentCount >= GetRemoteLimit(room)) {
        return;
    }
    const remotes: string[] = [];
    for (let dx = -REMOTE_SEARCH_RANGE; dx <= REMOTE_SEARCH_RANGE; dx++) {
        for (let dy = -REMOTE_SEARCH_RANGE; dy <= REMOTE_SEARCH_RANGE; dy++) {
            if (dx === 0 && dy === 0) {
                continue;
            }
            const remote = fromRoomCoordinate({
                x: roomCoord.x + dx,
                y: roomCoord.y + dy
            });
            if (
                Memory.rooms[remote] === undefined ||
                Memory.rooms[remote].roomLevel < 0 ||
                describeRoom(remote) !== "room" ||
                Memory.rooms[room.name].remotes.includes(remote)
            ) {
                continue;
            }
            const route = Game.map.findRoute(room.name, remote);
            if (route === -2 || route.length > REMOTE_SEARCH_RANGE) {
                continue;
            }
            let validRoute = true;
            for (const routeRoom of route) {
                if (Memory.rooms[routeRoom.room] === undefined || Memory.rooms[routeRoom.room].roomLevel < 0) {
                    validRoute = false;
                    break;
                }
            }
            if (!validRoute) {
                continue;
            }
            remotes.push(remote);
        }
    }

    remotes.sort((a, b) => {
        const aRoute = Game.map.findRoute(room.name, a);
        const bRoute = Game.map.findRoute(room.name, b);
        if (aRoute !== -2 && bRoute !== -2) {
            if (aRoute.length - bRoute.length === 0) {
                const aSources = Memory.rooms[a].basicRoomData.sources.length;
                const bSources = Memory.rooms[b].basicRoomData.sources.length;
                if (aSources - bSources === 0) {
                    const aCoord = toRoomCoordinate(a);
                    const bCoord = toRoomCoordinate(b);
                    if (aCoord!.x - bCoord!.x === 0) {
                        return aCoord!.y - bCoord!.y;
                    }
                    return aCoord!.x - bCoord!.x;
                }
                return bSources - aSources;
            }
            return aRoute.length - bRoute.length;
        } else {
            return 0;
        }
    });
    remotes.splice(GetRemoteLimit(room) - currentCount);
    room.memory.remotes = room.memory.remotes.concat(remotes);
}

function GetRemoteLimit(room: Room): number {
    if (room.memory.genBuildings === undefined) {
        return 0;
    }
    if (room.memory.targetRemoteCount !== undefined) {
        return room.memory.targetRemoteCount;
    }
    let spawnCount = 0;
    for (const spawn of room.memory.genBuildings?.spawns) {
        if (spawn.id !== undefined) {
            const object = Game.getObjectById(spawn.id);
            if (object instanceof StructureSpawn) {
                spawnCount++;
            }
        }
    }

    return spawnCount;
}
