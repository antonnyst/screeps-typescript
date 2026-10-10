import { Operation } from "operation/operation";
import { ProtectorMemory } from "creeps/roles";
import { rolePatterns } from "utils/CreepBodyGenerator";

export interface DisruptOperation extends Operation {
  type: "disrupt";
  protcount?: number;
}

function checkOperation(operation: Operation): operation is DisruptOperation {
  return operation.type === "disrupt";
}

export function disrupt(operation: Operation): boolean {
  if (!checkOperation(operation)) {
    return true;
  }

  if(operation.active) {
    if (operation.creeps.length < (operation.protcount ?? 1)) {
      operation.creeps.push({
        body: rolePatterns.ranged,
        memory: {
          role: "protector",
          home: operation.source,
          rooms: operation.target
        } as ProtectorMemory
      });
    }
  }
  return false;
}
