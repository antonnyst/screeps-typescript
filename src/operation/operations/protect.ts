import { Operation } from "operation/operation";
import { ProtectorMemory } from "creeps/roles";
import { RoomData } from "data/room/room";
import { rolePatterns } from "utils/CreepBodyGenerator";

export interface ProtectOperation extends Operation {
  type: "protect";
}

function checkOperation(operation: Operation): operation is ProtectOperation {
  return operation.type === "protect";
}

export function protect(operation: Operation): boolean {
  if (!checkOperation(operation)) {
    return true;
  }

  if (hasHostiles(operation.target)) {
    operation.active = true;
    if (operation.creeps.length === 0) {
      operation.creeps.push({
        body: rolePatterns.ranged,
        memory: {
          role: "protector",
          home: operation.source,
          rooms: operation.target
        } as ProtectorMemory
      });
    }
  } else {
    operation.active = false;
  }
  return false;
}

function hasHostiles(rooms: string[]): boolean {
  for (const room of rooms) {
    const hostiles = RoomData(room).hostiles.get();
    if (hostiles !== null && hostiles.length > 0) {
      return true;
    }
  }
  return false;
}
