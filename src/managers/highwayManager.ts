import { DEPOSIT_MAX_COOLDOWN, DEPOSIT_MAX_RANGE } from "config/constants";
import { OwnedRooms, describeRoom } from "utils/RoomCalc";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { DepositOperation } from "operation/operations";
import { Manager } from "./manager";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";

declare global {
  interface OwnedRoomMemory {
    scoutTargets?: string[];
  }
  interface Memory {
    mapRooms?: string;
    deposits?: Partial<Record<string, DepositData>>;
  }
}
export interface DepositData {
  pos: number;
  decayTime: number;
  lastCooldown: number;
  type: DepositConstant;
}

export class HighwayManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  public run(speed: number): void {
    if (Memory.deposits === undefined) {
      Memory.deposits = {};
    }

    // Deposit logic
    RunEvery(
      () => {
        for (const id in Memory.deposits) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const depositData = Memory.deposits[id];
          if (depositData !== undefined && depositData.lastCooldown <= DEPOSIT_MAX_COOLDOWN && !hasOperation(id)) {
            const position = unpackPosition(depositData.pos);
            const hostiles = RoomData(position.roomName).hostiles.get();
            if (hostiles !== null && hostiles.length > 0) {
              continue;
            }
            // Check range to closest owned room
            const rooms = OwnedRooms().filter(r => r.energyCapacityAvailable >= 3650);
            const distances: [OwnedRoom, number][] = rooms.map(r => {
              const route = Game.map.findRoute(r.name, position.roomName, {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                routeCallback: (roomName, _fromRoomName) => {
                  if (RoomData(roomName).control.get() === -2) {
                    return 25;
                  }
                  if (RoomData(roomName).control.get() === -1) {
                    return 5;
                  }
                  if (describeRoom(roomName) === "source_keeper") {
                    return 5;
                  }
                  const h = RoomData(roomName).hostiles.get();
                  if (h !== null && h.length > 0) {
                    return 2;
                  }
                  return 1;
                }
              });
              if (route === ERR_NO_PATH) {
                return [r, Infinity];
              }
              return [r, Object.keys(route).length];
            });
            if (_.some(distances, d => d[1] <= DEPOSIT_MAX_RANGE)) {
              // The deposit is in range; Add a new operation for this deposit
              const closestRoom = _.min(distances, d => d[1])[0];
              Memory.operations.push({
                type: "deposit",
                active: true,
                target: [position.roomName],
                source: closestRoom.name,
                creeps: [],
                squads: [],
                children: [],
                id: id as Id<Deposit>
              } as DepositOperation);
            }
          }
        }
      },
      "depositmanager",
      50 / speed
    );

    for (const room of Object.values(Game.rooms)) {
      const deposits = room.find(FIND_DEPOSITS);
      if (deposits.length > 0) {
        for (const deposit of deposits) {
          Memory.deposits[deposit.id] = {
            type: deposit.depositType,
            pos: packPosition(deposit.pos),
            decayTime: Game.time + deposit.ticksToDecay,
            lastCooldown: deposit.lastCooldown
          };
        }
      }
    }
  }
}

function hasOperation(id: string) {
  return Memory.operations.some(o => o.type === "deposit" && (o as DepositOperation).id === id);
}
