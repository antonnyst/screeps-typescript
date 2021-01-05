import { Manager } from "./manager";
import { ConstructionHandler } from "./roomManager/constructionHandler";
import { RepairHandler } from "./roomManager/repairHandler";
import { LayoutHandler } from "./roomManager/layoutHandler";
import { LinkHandler } from "./roomManager/linkHandler";
import { TerminalHandler } from "./roomManager/terminalHandler";
import { LabHandler } from "./roomManager/labHandler";
import { ResourceHandler } from "./roomManager/resourceHandler";
import { RunEvery, RunNow } from "utils/RunEvery";
import { VisualHandler } from "./roomManager/visualHandler";

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

    if (room.memory.roomLevel === 2 && room.memory.remotes === undefined) {
        room.memory.remotes = [];
    }
    if (room.memory.roomLevel === 2 && room.memory.remoteSupportRooms === undefined) {
        room.memory.remoteSupportRooms = [];
    }

    //Update room hostiles
    RunEvery(updateRoomHostiles, "roomlogicupdateroomhostiles" + roomName, 3 / speed, room);

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
    RunEvery(LayoutHandler, "roomlogiclayouthandler" + roomName, 50 / speed, room, speed);

    //TerminalHandler
    //RunEvery(TerminalHandler, "roomlogicterminalhandler" + roomName, 50 / speed, room);

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
    const newHostiles: { [key: string]: import("../dataInterfaces/hostileData").HostileData } = {};
    for (const creep of hostiles) {
        if (room.memory.hostiles[creep.id] !== undefined) {
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
