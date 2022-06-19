import * as OperationLogic from "./operations/";
import { CreepDescriptor, Operation } from "./operation";
import { GenerateBodyFromPattern, bodySortingValues } from "utils/CreepBodyGenerator";
import { RunEvery } from "utils/RunEvery";
import { generateName } from "utils/CreepNames";
import { isOwnedRoom } from "utils/RoomCalc";
import { runSquad } from "squad/runner";
import { spawnSquad } from "squad/squad";

export type OperationType = keyof typeof OperationLogic;

declare global {
  interface Memory {
    operations: Operation[];
  }
}

export function runLogic(speed: number): void {
  if (Memory.operations === undefined) {
    Memory.operations = [];
  }
  let general = false;
  RunEvery(
    () => {
      general = true;
    },
    "generaloperationlogic",
    10 / speed
  );
  runOperations(Memory.operations, general);
}

function runOperations(operations: Operation[], general: boolean): void {
  for (let i = operations.length - 1; i >= 0; i--) {
    const operation = operations[i];
    // eslint-disable-next-line import/namespace
    const result = OperationLogic[operation.type](operation);
    if (result) {
      operations.splice(i, 1);
    } else {
      runOperations(operation.children, general);
      for (const squad of operation.squads) {
        runSquad(squad);
      }

      if (general) {
        GeneralLogic(operation);
      }
    }
  }
}

function GeneralLogic(operation: Operation): void {
  if (!operation.active) {
    return;
  }

  const sourceBase = Game.rooms[operation.source];
  if (sourceBase === undefined || !isOwnedRoom(sourceBase)) {
    return;
  }

  // Creep spawning logic
  for (const creep of operation.creeps) {
    spawnCreep(creep, sourceBase);
  }

  // Squad spawning logic
  for (const squad of operation.squads) {
    if (!squad.spawned) {
      spawnSquad(squad, sourceBase);
      squad.spawned = true;
    } else {
      let allDead = true;
      for (const creep of squad.creeps) {
        if (creep.current !== undefined && Game.creeps[creep.current] === undefined) {
          let found = false;
          for (const queuedCreep of sourceBase.memory.spawnQueue) {
            if (queuedCreep.name === creep.current) {
              found = true;
              break;
            }
          }

          if (!found) {
            creep.current = undefined;
          }
        }
        if (creep.current !== undefined) {
          allDead = false;
        }
      }
      if (allDead) {
        squad.spawned = false;
      }
    }
  }
}

function spawnCreep(creep: CreepDescriptor, sourceBase: OwnedRoom): void {
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
    return;
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
      return;
    }
  }
}
