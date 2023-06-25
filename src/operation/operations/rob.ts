import { Operation } from "operation/operation";
import { Storage } from "buildings";
import { TransporterMemory } from "creeps/roles/transporter";

export interface RobOperation extends Operation {
  type: "rob";
}

function checkOperation(operation: Operation): operation is RobOperation {
  return operation.type === "rob";
}

export function rob(operation: Operation): boolean {
  if (!checkOperation(operation)) {
    return true;
  }
  if (operation.creeps.length === 0) {
    // Setup operation
    const result = setup(operation);
    if (result) {
      return true;
    }
  }

  return false;
}

function setup(operation: RobOperation): boolean {
  const homeRoom = Game.rooms[operation.source];
  const storage = Storage(homeRoom);
  if (homeRoom === undefined || storage === null) {
    return true;
  }
  for (const target of operation.target) {
    operation.creeps.push({
      body: "[mc]25",
      memory: {
        role: "transporter",
        home: operation.source,
        sourceRoom: target,
        sourceStore: undefined,
        targetRoom: operation.source,
        targetStore: storage.id
      } as TransporterMemory
    });
  }
  return false;
}
