import { ClaimerMemory } from "creeps/roles";
import { Manager } from "./manager";
import { RoomData } from "data/room/room";
import { displayBase } from "../layout/layout";
import { isOwnedRoom } from "../utils/RoomCalc";
import { packPosition } from "utils/RoomPositionPacker";

declare global {
  interface FlagMemory {
    processed?: boolean;
  }
}

export class FlagManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(_speed: number): void {
    for (const flag in Game.flags) {
      HandleFlag(Game.flags[flag]);
    }

    for (const flag in Memory.flags) {
      if (!Game.flags[flag]) {
        delete Memory.flags[flag];
      }
    }
  }
}

function HandleFlag(flag: Flag): void {
  const primaryColor: ColorConstant = flag.color;
  const secondaryColor: ColorConstant = flag.secondaryColor;

  if (flag.memory.processed === true) {
    flag.remove();
  } else {
    // Claim controller
    if (primaryColor === COLOR_RED && secondaryColor === COLOR_RED) {
      const room = Game.rooms[flag.name];
      if (room !== undefined && isOwnedRoom(room)) {
        room.memory.spawnQueue.push({
          role: "claimer",
          body: [CLAIM, MOVE],
          memory: {
            role: "claimer",
            home: flag.name,
            room: flag.pos.roomName
          } as ClaimerMemory
        });
        room.memory.remoteSupportRooms.push(flag.pos.roomName);
      }
      flag.memory.processed = true;
    }
    // Add remote
    if (primaryColor === COLOR_RED && secondaryColor === COLOR_PURPLE) {
      const room = Game.rooms[flag.name];
      if (room !== undefined && isOwnedRoom(room) && room.memory.remotes !== undefined) {
        room.memory.remotes.push(flag.pos.roomName);
      }
      flag.memory.processed = true;
    }
    // Show base layout
    if (primaryColor === COLOR_WHITE && secondaryColor === COLOR_WHITE) {
      const room = Game.rooms[flag.pos.roomName];

      const basicRoomData = RoomData(room.name).basicRoomData.get();

      if (basicRoomData === null) {
        RoomData(room.name).basicRoomData.prepare();
      } else if (room !== undefined && isOwnedRoom(room) && room.memory.genLayout !== undefined) {
        displayBase(flag.pos.roomName, basicRoomData, room.memory.genLayout);
      }
    }
    // Add road to layout
    if (primaryColor === COLOR_GREY && secondaryColor === COLOR_RED) {
      const room = Game.rooms[flag.pos.roomName];
      if (room !== undefined && isOwnedRoom(room) && room.memory.genLayout !== undefined) {
        room.memory.genLayout.roads.push(packPosition(flag.pos));
      }
      flag.memory.processed = true;
    }
    // Unclaim room
    if (primaryColor === COLOR_BLUE && secondaryColor === COLOR_WHITE) {
      const room = Game.rooms[flag.pos.roomName];
      if (room !== undefined && isOwnedRoom(room)) {
        room.memory.unclaim = 1;
      }
      flag.memory.processed = true;
    }

    // Scout room
    if (primaryColor === COLOR_BROWN && secondaryColor === COLOR_WHITE) {
      const room = Game.rooms[flag.name];
      if (room !== undefined && isOwnedRoom(room) && room.memory.scoutTargets !== undefined) {
        room.memory.scoutTargets.push(flag.pos.roomName);
      }
      flag.memory.processed = true;
    }

    // Destroy all walls
    if (primaryColor === COLOR_GREY && secondaryColor === COLOR_GREY) {
      const room = Game.rooms[flag.pos.roomName];
      if (room !== undefined && isOwnedRoom(room)) {
        const walls = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } });
        for (const wall of walls) {
          wall.destroy();
        }
      }
      flag.memory.processed = true;
    }
  }
}
