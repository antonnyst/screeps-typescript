import * as OperationLogic from "./operations/";
import { GenerateBodyFromPattern, bodySortingValues } from "utils/CreepBodyGenerator";
import { Operation } from "./operation";
import { RunEvery } from "utils/RunEvery";
import { generateName } from "utils/CreepNames";
import { isOwnedRoom } from "utils/RoomCalc";

export type OperationType = keyof typeof OperationLogic;

declare global {
  interface Memory {
    operations: Operation[];
  }
}

export function runOperations(speed: number): void {
  if (Memory.operations === undefined) {
    Memory.operations = [];
  }

  for (let i = Memory.operations.length - 1; i >= 0; i--) {
    const operation = Memory.operations[i];
    // eslint-disable-next-line import/namespace
    const result = OperationLogic[operation.type](operation);
    if (result) {
      Memory.operations.splice(i, 1);
    }
  }

  RunEvery(
    () => {
      for (const operation of Memory.operations) {
        if (operation.expire && operation.expire < Game.time) {
          continue;
        }

        const sourceBase = Game.rooms[operation.source];
        if (sourceBase === undefined || !isOwnedRoom(sourceBase)) {
          continue;
        }

        // Individual creep logic
        for (const creep of operation.creeps) {
          // Spawn creeps with no current name
          if (creep.current === undefined) {
            const name = generateName();
            const memory = creep.memory;
            sourceBase.memory.spawnQueue.push({
              memory,
              body: GenerateBodyFromPattern(creep.body, sourceBase.energyCapacityAvailable).sort(
                (a, b) => bodySortingValues[a] - bodySortingValues[b]
              ),
              name
            });

            creep.current = name;
            continue;
          }

          // Handle creeps we cannot find
          if (Game.creeps[creep.current] === undefined) {
            // We cant find our current creep
            // Check for it in spawn queues before removing current name

            let found = false;
            for (const queuedCreep of sourceBase.memory.spawnQueue) {
              if (queuedCreep.name === creep.current) {
                found = true;
                break;
              }
            }

            if (!found) {
              creep.current = undefined;
              continue;
            }
          }
        }
      }
    },
    "runoperations",
    10 / speed
  );
}
