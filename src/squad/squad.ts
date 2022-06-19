import { GenerateBodyFromPattern, bodySortingValues } from "utils/CreepBodyGenerator";
import { CreepDescriptor } from "operation/operation";
import { SquadType } from "./runner";
import { generateName } from "utils/CreepNames";

// Contains information about a squad
export interface Squad {
  type: SquadType;
  creeps: CreepDescriptor[];
  spawned?: boolean;
}

export function spawnSquad(squad: Squad, sourceBase: OwnedRoom): void {
  // Spawn creeps
  for (const creep of squad.creeps) {
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
  }
}
