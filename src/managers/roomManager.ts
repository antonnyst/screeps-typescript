import { Manager } from "./manager";
import { SpawnHandler } from "./roomManager/spawnHandler";
import { ConstructionHandler } from "./roomManager/constructionHandler";
import { RepairHandler } from "./roomManager/repairHandler";
import { LayoutHandler } from "./roomManager/layoutHandler";
import { LinkHandler } from "./roomManager/linkHandler";
import { TerminalHandler } from "./roomManager/terminalHandler";
import { LabHandler } from "./roomManager/labHandler";
import { ResourceHandler } from "./roomManager/resourceHandler";

export class RoomManager implements Manager {
    run() {
        for (let room in Game.rooms) {
            roomLogic(room);
        }
    }
}

function roomLogic(roomName: string): void {
    const room: Room = Game.rooms[roomName];

    if (room.memory.roomLevel === undefined || Game.time % 50 === 0) {
        room.memory.roomLevel = getRoomLevel(room);
    }
    if (Game.time % 3 === 0) {
        updateRoomHostiles(room);
    }
    if (
        (room.memory.reservation != undefined || room.memory.roomLevel === -1 || room.memory.roomLevel === 1) &&
        Game.time % 5 === 0
    ) {
        updateRoomReservation(room);
    }

    if (room.memory.roomLevel === 2 && room.memory.remotes === undefined) {
        room.memory.remotes = [];
    }
    if (room.memory.roomLevel === 2 && room.memory.remoteSupportRooms === undefined) {
        room.memory.remoteSupportRooms = [];
    }

    if (Game.cpu.bucket > 5000 || Game.time % 50 === 0) {
        ResourceHandler(room);

        LayoutHandler(room);

        TerminalHandler(room);

        LabHandler(room);
    }

    SpawnHandler(room);

    ConstructionHandler(room);

    RepairHandler(room);

    LinkHandler(room);
}

function getRoomLevel(room: Room): number {
    if (room.controller === undefined) {
        return 0;
    }
    if (room.controller.my) {
        return 2;
    }
    const hasOwnStructures: Boolean = room.find(FIND_MY_STRUCTURES).length > 0 ? true : false;
    if (hasOwnStructures) {
        return 2;
    }
    if (
        room.controller.owner != undefined &&
        room.controller.owner.username != Game.spawns[Object.keys(Game.spawns)[0]].owner.username
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
    let newHostiles: { [key: string]: import("../dataInterfaces/hostileData").HostileData } = {};
    for (let i = 0; i < hostiles.length; i++) {
        const creep = hostiles[i];
        if (room.memory.hostiles[creep.id] != undefined) {
            newHostiles[creep.id] = room.memory.hostiles[creep.id];
        } else {
            newHostiles[creep.id] = {
                id: creep.id,
                pos: creep.pos,
                body: creep.body,
                firstSeen: Game.time
            };
        }
    }
    room.memory.hostiles = newHostiles;
}
function updateRoomReservation(room: Room): void {
    room.memory.reservation = room.controller?.reservation;
}
