import { DepositHarvesterMemory } from "creeps/roles";
import { EmptySpaces } from "utils/terrain";
import { Operation } from "operation/operation";
import { RoomData } from "data/room/room";
import { describeRoom } from "utils/RoomCalc";
import { rolePatterns } from "utils/CreepBodyGenerator";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface DepositOperation extends Operation {
  type: "deposit";
  id: Id<Deposit>;
  route: string[];
}

const DEPOSIT_MAX_COOLDOWN = 100;

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

  const position = unpackPosition(depositData.pos);
  if (depositData.lastCooldown < DEPOSIT_MAX_COOLDOWN) {
    if (operation.creeps.length === 0) {
      // Setup operation
      const spaces = EmptySpaces(position);
      for (let i = 0; i < spaces; i++) {
        operation.creeps.push({
          body: rolePatterns.harvester,
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
          if (hostiles === null || hostiles.length > 0) {
            return 2;
          }
          return 1;
        }
      });
      if (route === ERR_NO_PATH) {
        return true;
      }
      operation.children.push({
        type: "protect",
        target: route.map(a => a.room),
        source: operation.source,
        squads: [],
        creeps: [],
        children: []
      });
    }
  } else {
    operation.creeps = [];
    operation.children = [];
  }

  return false;
}
