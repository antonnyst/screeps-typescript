import { GenerateBodyFromPattern, bodySortingValues, rolePatterns } from "utils/CreepBodyGenerator";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { DepositHarvesterMemory } from "creeps/roles";
import { Manager } from "./manager";
import { OwnedRooms } from "utils/RoomCalc";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";

declare global {
  interface OwnedRoomMemory {
    scoutTargets?: string[];
  }
  interface Memory {
    mapRooms?: string;
    deposits?: Record<string, DepositData>;
  }
}
interface DepositData {
  pos: number;
  decayTime: number;
  lastCooldown: number;
  type: DepositConstant;
}

const DEPOSIT_MAX_COOLDOWN = 100;
const DEPOSIT_MAX_RANGE = 3;

export class DepositManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  public run(speed: number): void {
    if (Memory.deposits === undefined) {
      Memory.deposits = {};
    }

    RunEvery(
      () => {
        for (const id in Memory.deposits) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (Memory.deposits[id]!.decayTime < Game.time && !hasHarvesters(id)) {
            delete Memory.deposits[id];
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          } else if (Memory.deposits[id]!.lastCooldown <= DEPOSIT_MAX_COOLDOWN) {
            // Lets check if we should spawn an harvester for this deposit
            const pos = unpackPosition(Memory.deposits[id].pos);
            const hostiles = RoomData(pos.roomName).hostiles.get();
            if (!hasHarvesters(id) && (hostiles === null || hostiles.length === 0)) {
              // Check range
              const rooms = OwnedRooms().filter(r => r.energyCapacityAvailable >= 3650);

              const distances: [OwnedRoom, number][] = rooms.map(r => {
                const route = Game.map.findRoute(r.name, pos.roomName);
                if (route === ERR_NO_PATH) {
                  return [r, Infinity];
                }
                return [r, Object.keys(route).length];
              });

              if (_.some(distances, d => d[1] <= DEPOSIT_MAX_RANGE)) {
                const closestRoom = distances.sort((a, b) => a[1] - b[1])[0];

                if (closestRoom[0].memory.spawnQueue !== undefined) {
                  closestRoom[0].memory.spawnQueue.push({
                    body: GenerateBodyFromPattern(rolePatterns.depositHarvester, 3650).sort(
                      (a, b) => bodySortingValues[a] - bodySortingValues[b]
                    ),
                    memory: {
                      role: "depositHarvester",
                      home: closestRoom[0].name,
                      id
                    } as DepositHarvesterMemory
                  });
                }
              }
            }
          }
        }
      },
      "depositmanager",
      10 / speed
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

function hasHarvesters(id: string) {
  const spawned = _.some(
    Game.creeps,
    c => c.memory.role === "depositHarvester" && (c.memory as DepositHarvesterMemory).id === id
  );
  if (spawned) return true;

  const queued = _.some(OwnedRooms(), r =>
    _.some(
      r.memory.spawnQueue,
      s =>
        s.memory !== undefined && s.memory.role === "depositHarvester" && (s.memory as DepositHarvesterMemory).id === id
    )
  );

  return queued;
}
