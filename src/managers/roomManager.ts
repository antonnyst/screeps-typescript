import { HostileData, RoomData } from "data/room/room";
import { describeRoom, isOwnedRoom } from "utils/RoomCalc";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { ConstructionHandler } from "./roomManager/constructionHandler";
import { LabHandler } from "./roomManager/labHandler";
import { LayoutHandler } from "./roomManager/layoutHandler";
import { LinkHandler } from "./roomManager/linkHandler";
import { Manager } from "./manager";
import { Observer } from "buildings";
import { PowerHandler } from "./roomManager/powerHandler";
import { RemoteHandler } from "./roomManager/remoteHandler";
import { RepairHandler } from "./roomManager/repairHandler";
import { ResourceHandler } from "./roomManager/resourceHandler";
import { RunEvery } from "utils/RunEvery";
import { VisualHandler } from "./roomManager/visualHandler";
import { generateBasicRoomData } from "layout/layout";

declare global {
  interface OwnedRoom extends Room {
    controller: OwnedController;
    memory: OwnedRoomMemory;
  }
  interface OwnedRoomMemory extends RoomMemory {
    remotes: string[];
    remoteSupportRooms: string[];
    targetRemoteCount?: number;
    unclaim?: number;
  }
}

interface OwnedController extends StructureController {
  my: true;
}

export class RoomManager implements Manager {
  public minSpeed = 0.2;
  public maxSpeed = 1;
  public run(speed: number): void {
    for (const room in Game.rooms) {
      roomLogic(Game.rooms[room], speed);
    }
  }
}

function roomLogic(room: Room, speed: number): void {
  generalRoomLogic(room, speed);
  if (isOwnedRoom(room)) {
    ownedRoomLogic(room, speed);
  } else if (Memory.rooms[room.name] !== undefined) {
    delete Memory.rooms[room.name];
  }
}

function generalRoomLogic(room: Room, speed: number): void {
  // Update control level
  RunEvery(
    () => {
      RoomData(room.name).control.set(GetControlLevel(room));
      RoomData(room.name).lastUpdate.set(Game.time);
    },
    room.name + "updateControl",
    10 / speed
  );

  // Update hostiles
  RunEvery(UpdateRoomHostiles, room.name + "updateHostiles", 10 / speed, room);

  // Get basic room data
  RunEvery(
    () => {
      if (RoomData(room.name).basicRoomData.has() === false) {
        const data = generateBasicRoomData(room);
        RoomData(room.name).basicRoomData.set(data);
      }
    },
    room.name + "updateBasicRoomData",
    100 / speed
  );

  // Update room reservation status
  RunEvery(
    () => {
      const control = RoomData(room.name).control.get();
      if (control !== null && (control === -1 || control === 1)) {
        UpdateRoomReservation(room);
      }
    },
    room.name + "updateReservation",
    5 / speed
  );
}

function ownedRoomLogic(room: OwnedRoom, speed: number): void {
  if (room.memory.remoteSupportRooms === undefined) {
    room.memory.remoteSupportRooms = [];
  }

  // Unclaim logic
  if (room.memory.unclaim === 2) {
    for (const creep of _.filter(Game.creeps, c => c.memory.home === room.name)) {
      creep.suicide();
    }
    for (const structure of room.find(FIND_MY_STRUCTURES)) {
      structure.destroy();
    }
    room.controller.unclaim();
    return;
  }

  // Observer logic
  const obsever = Observer(room);
  if (obsever !== null && room.memory.scoutTargets !== undefined) {
    const obt = room.memory.scoutTargets.shift();
    if (obt !== undefined) {
      obsever.observeRoom(obt);
      console.log(`${room.name} observing ${obt}`);
    }
  }

  // ResourceHandler
  RunEvery(ResourceHandler, room.name + "resourceHandler", 5 / speed, room);

  // PowerHandler
  PowerHandler(room);

  // LayoutHandler
  RunEvery(LayoutHandler, room.name + "layoutHandler", 10 / speed, room);

  // LabHandler
  RunEvery(LabHandler, room.name + "labHandler", 5 / speed, room);

  // ConstructionHandler
  RunEvery(ConstructionHandler, room.name + "constructionHandler", 5 / speed, room);

  // RepairHandler
  RunEvery(RepairHandler, room.name + "repairHandler", 5 / speed, room);

  // LinkHandler
  RunEvery(LinkHandler, room.name + "linkHandler", 4 / speed, room);

  // RemoteHandler
  RunEvery(RemoteHandler, room.name + "remoteHandler", 250 / speed, room);

  // RemoteDecisions
  RunEvery(
    () => {
      remoteDecisions(room);
    },
    room.name + "remoteDecisions",
    250 / speed
  );

  // VisualHandler
  VisualHandler(room, speed);
}

function GetControlLevel(room: Room): number {
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

function UpdateRoomHostiles(room: Room): void {
  const hostiles: Creep[] = room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) {
    RoomData(room.name).hostiles.set(null);
    return;
  }

  const oldHostiles = RoomData(room.name).hostiles.get() ?? [];
  const newHostiles: HostileData[] = [];
  for (const creep of hostiles) {
    const prev = oldHostiles.find(h => h.id === creep.id);
    if (prev !== undefined) {
      newHostiles.push(prev);
    } else if (
      (RoomData(room.name).control.get() ?? 0) === 2 ||
      creep.getActiveBodyparts(ATTACK) > 0 ||
      creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
      creep.getActiveBodyparts(CLAIM) > 0 ||
      creep.getActiveBodyparts(CARRY) > 0 ||
      creep.getActiveBodyparts(WORK) > 0 ||
      creep.getActiveBodyparts(HEAL) > 0
    ) {
      newHostiles.push({
        id: creep.id,
        pos: creep.pos,
        body: creep.body,
        firstSeen: Game.time
      });
    }
  }
  RoomData(room.name).hostiles.set(newHostiles);
}

function UpdateRoomReservation(room: Room): void {
  RoomData(room.name).reservation.set(room.controller?.reservation ?? null);
}

const REMOTE_SEARCH_RANGE = 2;

function remoteDecisions(room: OwnedRoom): void {
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
      if (remote === null) {
        continue;
      }
      if (
        (RoomData(remote).control.get() ?? 0) < 0 ||
        describeRoom(remote) !== "room" ||
        room.memory.remotes.includes(remote)
      ) {
        continue;
      }
      const route = Game.map.findRoute(room.name, remote);
      if (route === -2 || route.length > REMOTE_SEARCH_RANGE) {
        continue;
      }
      let validRoute = true;
      for (const routeRoom of route) {
        if ((RoomData(routeRoom.room).control.get() ?? 0) < 0) {
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
        const aSources = RoomData(a).basicRoomData.get()?.sources.length ?? 0; // TODO: fix this
        const bSources = RoomData(b).basicRoomData.get()?.sources.length ?? 0;
        if (aSources - bSources === 0) {
          const aCoord = toRoomCoordinate(a);
          const bCoord = toRoomCoordinate(b);
          if (aCoord !== null && bCoord !== null) {
            if (aCoord.x - bCoord.x === 0) {
              return aCoord.y - bCoord.y;
            }
            return aCoord.x - bCoord.x;
          }
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

function GetRemoteLimit(room: OwnedRoom): number {
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

  return spawnCount + 1;
  // TODO: fix this
}
