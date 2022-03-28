import { DEPOSIT_MAX_COOLDOWN } from "config/constants";
import { DepositData } from "managers/highwayManager";
import { DepositHarvesterMemory } from "creeps/roles";
import { EmptySpaces } from "utils/terrain";
import { Operation } from "operation/operation";
import { ProtectOperation } from ".";
import { RoomData } from "data/room/room";
import { RunEvery } from "utils/RunEvery";
import { describeRoom } from "utils/RoomCalc";
import { rolePatterns } from "utils/CreepBodyGenerator";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface DepositOperation extends Operation {
  type: "deposit";
  id: Id<Deposit>;
  route?: string[];
}

function checkOperation(operation: Operation): operation is DepositOperation {
  return operation.type === "deposit" && (operation as DepositOperation).id !== undefined;
}

export function deposit(operation: Operation): boolean {
  if (!checkOperation(operation) || Memory.deposits === undefined) {
    return true;
  }

  const depositData = Memory.deposits[operation.id];
  if (depositData === undefined) {
    return true;
  }

  if (depositData.lastCooldown < DEPOSIT_MAX_COOLDOWN) {
    if (operation.creeps.length === 0) {
      // Setup operation
      const result = setup(operation, depositData);
      if (result) {
        return true;
      }
    }
  } else {
    return true;
  }
  let surrender = false;
  RunEvery(
    () => {
      if (operation.route && isRouteClear(operation.route)) {
        operation.active = true;
      } else {
        operation.active = false;

        if (operation.route) {
          const hostiles = RoomData(operation.route[operation.route.length - 1]).hostiles.get();
          if (hostiles !== null && hostiles.length > 0) {
            let parts = 0;
            for (const hostile of hostiles) {
              for (const part of hostile.body) {
                if (part.type === "attack" || part.type === "ranged_attack" || part.type === "heal") {
                  parts++;
                }
              }
            }
            if (parts > 20) {
              surrender = true;
            }
          }
        }
      }
    },
    "operationdeposit" + operation.id,
    10
  );

  return surrender;
}

function isRouteClear(route: string[]): boolean {
  for (const room of route) {
    const hostiles = RoomData(room).hostiles.get();
    if (hostiles !== null && hostiles.length > 0) {
      return false;
    }
  }
  return true;
}

function setup(operation: DepositOperation, depositData: DepositData): boolean {
  const position = unpackPosition(depositData.pos);
  const spaces = EmptySpaces(position);
  for (let i = 0; i < spaces; i++) {
    operation.creeps.push({
      body: rolePatterns.depositHarvester,
      memory: {
        role: "depositHarvester",
        home: operation.source,
        id: operation.id
      } as DepositHarvesterMemory
    });
  }

  const route = Game.map.findRoute(operation.source, position.roomName, {
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
      const hostiles = RoomData(roomName).hostiles.get();
      if (hostiles !== null && hostiles.length > 0) {
        return 2;
      }
      return 1;
    }
  });
  if (route === ERR_NO_PATH) {
    return true;
  }
  operation.route = route.map(a => a.room);
  operation.children = [
    {
      type: "protect",
      active: true,
      target: [position.roomName],
      source: operation.source,
      squads: [],
      creeps: [],
      children: []
    } as ProtectOperation
  ];
  return false;
}
