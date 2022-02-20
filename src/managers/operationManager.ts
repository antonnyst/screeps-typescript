import { bodySortingValues, GenerateBodyFromPattern } from "utils/CreepBodyGenerator";
import { generateName } from "utils/CreepNames";
import { RunEvery } from "utils/RunEvery";
import { Manager } from "./manager";
import { isOwnedRoom } from "../utils/RoomCalc";

declare global {
    interface Memory {
        operations: Operation[];
    }
}

// Contains information about an operation
interface Operation {
    expire?: number;
    target: string;
    source: string;
    squads: Squad[];
    creeps: CreepDescriptor[];
}

// Contains information about a squad
// tslint:disable-next-line: no-empty-interface
interface Squad {}

// Creep descriptor
interface CreepDescriptor {
    current?: string;
    body: string;
    memory: CreepMemory;
}

export class OperationManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        RunEvery(
            () => {
                if (Memory.operations === undefined) {
                    Memory.operations = [];
                }

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
            "operationsmanagermain",
            10 / speed
        );
    }
}
