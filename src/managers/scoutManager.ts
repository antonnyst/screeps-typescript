import { OwnedRooms, RoomDescription, describeRoom } from "../utils/RoomCalc";
import { fromRoomCoordinate, toRoomCoordinate } from "utils/RoomCoordinate";
import { Manager } from "./manager";
import { Observer } from "buildings";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";

declare global {
  interface OwnedRoomMemory {
    scoutTargets?: string[];
  }
  interface Memory {
    mapRooms?: string;
  }
}

const SCOUT_RANGE = 8;
const DEFAULT_SCOUT_UPDATE_TIME = 10000;
const SCOUT_UPDATE_TIMES: Partial<Record<RoomDescription, number>> = {
  highway: 500,
  // eslint-disable-next-line camelcase
  highway_portal: 500
};

export class ScoutManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  public run(speed: number): void {
    RunEvery(
      () => {
        // Gather all owned rooms
        const ownedRooms: string[] = OwnedRooms().map(r => r.name);

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

              const index = rooms.map(a => a[0]).findIndex(a => a === otherRoom);
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  }
}
