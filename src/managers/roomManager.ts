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

function roomLogic(roomName:string):void {    
    const room:Room = Game.rooms[roomName];

    if (room.memory.roomLevel === undefined || Game.time % 50 === 0) {
        room.memory.roomLevel = getRoomLevel(room);
    }
    if (Game.time % 3 === 0) {
        updateRoomHostiles(room);
    }
    if ((room.memory.reservation != undefined || room.memory.roomLevel === -1 || room.memory.roomLevel === 1) && Game.time % 5 === 0) {
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

function getRoomLevel(room: Room):number {
    if (room.controller === undefined) {
        return 0;
    }
    if (room.controller.my) {
        return 2;
    }
    const hasOwnStructures: Boolean = (room.find(FIND_MY_STRUCTURES).length > 0) ? true:false;
    if (hasOwnStructures) {
        return 2;
    }
    if (room.controller.owner != undefined && room.controller.owner.username != Game.spawns [Object.keys(Game.spawns)[0]].owner.username ) {
        return -2;
    }
    const reservation: ReservationDefinition|undefined = room.controller.reservation;
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
    let newHostiles:{[key: string] : import("../dataInterfaces/hostileData").HostileData} = {};
    for (let i = 0; i < hostiles.length; i++) {
        const creep = hostiles[i];
        if (room.memory.hostiles[creep.id] != undefined) {
            newHostiles[creep.id] = room.memory.hostiles[creep.id];
        } else {
            newHostiles[creep.id] = {
                id:creep.id,
                pos:creep.pos,
                body:creep.body,
                firstSeen:Game.time   
            };
        }
    }
    room.memory.hostiles = newHostiles;
}
function updateRoomReservation(room: Room):void {
    room.memory.reservation = (room.controller === undefined) ? undefined:room.controller.reservation;
}
const costMatrixFullOne = function(roomName:string):CostMatrix {
    let costs = new PathFinder.CostMatrix;
    for (let x:number = 0; x < 50; x++) {
        for (let y:number = 0; y < 50; y++) {
            costs.set(x,y,1);
        }
    }
    return costs;
}
function getBaseLocation(room: Room):RoomPosition {
    if (room.controller != undefined && room.controller.my && room.find(FIND_MY_SPAWNS).length === 1) {
        return room.find(FIND_MY_SPAWNS)[0].pos;
    }
    const terrain:RoomTerrain = new Room.Terrain(room.name);
    let goals:{pos:RoomPosition;range:number}[] = [];
    for (let x:number = 0; x < 50; x++) {
        for (let y:number = 0; y < 50; y++) {
            if (terrain.get(x,y) == TERRAIN_MASK_WALL) {
                goals.push({
                    pos:new RoomPosition(x,y,room.name),
                    range:1
                });
            }
        }         
    }
    const search:PathFinderPath = PathFinder.search(new RoomPosition(25,25,room.name),goals, {
        flee:true,
        roomCallback:costMatrixFullOne
    });
    const path = search.path;
    if (path.length === 0) {
        return new RoomPosition(25,25,room.name);
    }
    return path[path.length-1];
}
/*function getControllerLocation(room: Room):RoomPosition {
    if (room.controller === undefined) {
        return new RoomPosition(25,25,room.name);
    }
    const goal:{pos:RoomPosition;range:number} = {
        pos:room.controller.pos,
        range:1
    }

    const search:PathFinderPath = PathFinder.search(room.memory.baseLocation as RoomPosition, goal);
    const path:RoomPosition[] = search.path;

    return path[path.length-1];
}
function getSources(room: Room):OldSourceData[] {
    const sources:Source[] = room.find(FIND_SOURCES);
    const sourceData: OldSourceData[] = [];

    if (sources.length > 0) {
        for(let i:number = 0; i < sources.length; i++) {
            const s:Source = sources[i];
            const search:PathFinderPath = PathFinder.search(room.memory.baseLocation as RoomPosition, {
                pos:s.pos,
                range:1
            }, {
                swampCost:1
            });
            const path:RoomPosition[] = search.path;
            if (path.length >= 2) {
                const pos = path[path.length-1];
                let dir:number = path[path.length-2].getDirectionTo(path[path.length-1])-1;
                if (dir < 1) { dir += 8; }
                let delta:{x:number,y:number} = getDeltaFromDirection(dir as DirectionConstant);
                let lpos:RoomPosition = new RoomPosition(path[path.length-2].x + delta.x,path[path.length-2].y + delta.y, room.name);
                const terrain = new Room.Terrain(room.name);
                if (terrain.get(lpos.x,lpos.y) === TERRAIN_MASK_WALL) {
                    dir += 2;
                    if (dir > 8) { dir -= 8; }
                    delta = getDeltaFromDirection(dir as DirectionConstant);
                    lpos = new RoomPosition(path[path.length-2].x + delta.x,path[path.length-2].y + delta.y, room.name);
                    if (terrain.get(lpos.x,lpos.y) === TERRAIN_MASK_WALL) {
                        console.log("no link placement found");
                    }
                }

                sourceData.push({
                    id:s.id,
                    minerPos:pos,
                    linkPos:lpos,
                    extensions:[],
                    link:1
                });
            } else {
                console.log("short path err" + room.name);
            }
        }
    }

    return sourceData;
}
*/
function getDeltaFromDirection(direction:DirectionConstant):{x:number,y:number} {
    switch (direction) {
        case TOP_RIGHT:
            return { x:1, y:-1 }
        case RIGHT:
            return { x:1, y:0 }
        case BOTTOM_RIGHT:
            return { x:1, y:1 }
        case BOTTOM:
            return { x:0, y:1 }
        case BOTTOM_LEFT:
            return { x:-1, y:1 }
        case LEFT:
            return { x:-1, y:0 }
        case TOP_LEFT:
            return { x:-1, y:-1 }
        case TOP:
            return { x:0, y:-1 }
        default:
            console.log("invalid direction");
            return { x:0, y:0 }

    }
}