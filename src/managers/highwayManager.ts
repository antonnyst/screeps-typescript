import { DEPOSIT_MAX_COOLDOWN, DEPOSIT_MAX_RANGE, POWER_BANK_MAX_RANGE, POWER_BANK_MIN_AMOUNT } from "config/constants";
import { DepositOperation, PowerBankOperation } from "operation/operations";
import { OwnedRooms, describeRoom } from "utils/RoomCalc";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { Manager } from "./manager";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";
import { findRoute } from "pathfinding/findRoute";

declare global {
  interface Memory {
    mapRooms?: string;
    deposits?: Partial<Record<string, DepositData>>;
    powerBanks?: Partial<Record<string, PowerBankData>>;
  }
}
export interface DepositData {
  pos: number;
  decayTime: number;
  lastCooldown: number;
  type: DepositConstant;
}
export interface PowerBankData {
  pos: number;
  decayTime: number;
  amount: number;
  hits: number;
}

export class HighwayManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  public run(speed: number): void {
    if (Memory.deposits === undefined) {
      Memory.deposits = {};
    }
    if (Memory.powerBanks === undefined) {
      Memory.powerBanks = {};
    }

    // Deposit logic
    RunEvery(
      () => {
        const deleteIds = [];
        for (const id in Memory.deposits) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const depositData = Memory.deposits[id];
          if (depositData !== undefined && depositData.decayTime < Game.time && !hasOperation(id)) {
            deleteIds.push(id);
          } else if (
            depositData !== undefined &&
            depositData.lastCooldown <= DEPOSIT_MAX_COOLDOWN &&
            !hasOperation(id)
          ) {
            const position = unpackPosition(depositData.pos);
            const hostiles = RoomData(position.roomName).hostiles.get();
            if (hostiles !== null && hostiles.length > 0) {
              continue;
            }
            // Check range to closest owned room
            const rooms = OwnedRooms().filter(r => r.energyCapacityAvailable >= 3650);
            const distances: [OwnedRoom, number][] = rooms.map(r => {
              const route = findRoute(r.name, position.roomName);
              if (route === ERR_NO_PATH) {
                return [r, Infinity];
              }
              return [r, Object.keys(route).length];
            });
            if (distances.some(d => d[1] <= DEPOSIT_MAX_RANGE)) {
              // The deposit is in range; Add a new operation for this deposit
              const closestRoom = _.min(distances, d => d[1])[0];
              Memory.operations.push({
                type: "deposit",
                active: false,
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
        if (Memory.deposits) {
          for (const id of deleteIds) {
            delete Memory.deposits[id];
          }
        }
      },
      "highwaymanagerdeposit",
      50 / speed
    );

    // PowerBank logic
    RunEvery(
      () => {
        const deleteIds = [];
        for (const id in Memory.powerBanks) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const powerBankData = Memory.powerBanks[id];
          if (powerBankData === undefined || (powerBankData.decayTime < Game.time && !hasOperation(id))) {
            deleteIds.push(id);
          } else if (
            powerBankData !== undefined &&
            powerBankData.amount >= POWER_BANK_MIN_AMOUNT &&
            !hasOperation(id)
          ) {
            if (Game.time > 0) {
              continue;
            }
            const position = unpackPosition(powerBankData.pos);
            const hostiles = RoomData(position.roomName).hostiles.get();
            if (hostiles !== null && hostiles.length > 0) {
              continue;
            }
            // Check range to closest owned room
            const rooms = OwnedRooms().filter(r => r.controller.level === 8 && !roomHasPowerOperation(r.name));
            const distances: [OwnedRoom, number][] = rooms.map(r => {
              const route = findRoute(r.name, position.roomName);
              if (route === ERR_NO_PATH) {
                return [r, Infinity];
              }
              return [r, Object.keys(route).length];
            });
            if (distances.some(d => d[1] <= POWER_BANK_MAX_RANGE)) {
              // The power bank is in range; Add a new operation for this power bank
              const closestRoom = _.min(distances, d => d[1])[0];
              Memory.operations.push({
                type: "powerbank",
                active: false,
                target: [position.roomName],
                source: closestRoom.name,
                creeps: [],
                squads: [],
                children: [],
                id: id as Id<StructurePowerBank>
              } as PowerBankOperation);
            }
          }
        }
        if (Memory.powerBanks) {
          for (const id of deleteIds) {
            delete Memory.powerBanks[id];
          }
        }
      },
      "highwaymanagerpowerbank",
      50 / speed
    );

    // Register highway objects
    for (const room of Object.values(Game.rooms)) {
      const roomType = describeRoom(room.name);
      if (roomType !== "highway" && roomType !== "highway_portal") {
        continue;
      }
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
      const powerBanks: StructurePowerBank[] = room.find(FIND_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_POWER_BANK
      });
      if (powerBanks.length > 0) {
        for (const powerBank of powerBanks) {
          Memory.powerBanks[powerBank.id] = {
            pos: packPosition(powerBank.pos),
            decayTime: Game.time + powerBank.ticksToDecay,
            amount: powerBank.power,
            hits: powerBank.hits
          };
        }
      }
    }
  }
}

function hasOperation(id: string) {
  return Memory.operations.some(
    o =>
      (o.type === "deposit" && (o as DepositOperation).id.toString() === id) ||
      (o.type === "powerbank" && (o as PowerBankOperation).id.toString() === id)
  );
}

function roomHasPowerOperation(roomName: string) {
  return Memory.operations.some(o => o.type === "powerbank" && (o as PowerBankOperation).source === roomName);
}
