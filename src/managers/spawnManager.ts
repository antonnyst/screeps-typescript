import { Manager } from "./manager";
import { SpawnData } from "../dataInterfaces/spawnData";
import { GenerateBodyFromPattern, bodySortingValues } from "../utils/CreepBodyGenerator";
import { packPosition } from "../utils/RoomPositionPacker";

export class SpawnManager implements Manager {
    public run() {
        for (const i in Game.rooms) {
            const room: Room = Game.rooms[i];
            if (room.memory.roomLevel === 2 && room.memory.spawnQueue && room.memory.spawnQueue.length > 0) {
                const spawn: StructureSpawn = room.find(FIND_MY_SPAWNS, {
                    filter: (s) => s.spawning === null
                })[0];

                if (spawn !== undefined) {
                    const spawnData: SpawnData | undefined = room.memory.spawnQueue.shift();

                    if (spawnData !== undefined) {
                        let body: BodyPartConstant[] | undefined;
                        if (spawnData.body === undefined) {
                            if (spawnData.pattern !== undefined && spawnData.energy !== undefined) {
                                body = GenerateBodyFromPattern(spawnData.pattern, spawnData.energy).sort(
                                    (a, b) => bodySortingValues[a] - bodySortingValues[b]
                                );
                            } else {
                                console.log("SpawnData error");
                            }
                        } else {
                            body = spawnData.body;
                        }
                        let memory: CreepMemory | undefined;
                        if (spawnData.memory === undefined) {
                            if (spawnData.role !== undefined) {
                                memory = { role: spawnData.role, home: room.name };
                            } else {
                                console.log("SpawnData error");
                            }
                        } else {
                            memory = spawnData.memory;
                        }

                        let name: string =
                            packPosition(new RoomPosition(25, 25, room.name)).toString(16) +
                            (Game.time % 100000).toString(16);
                        name = name.replace("-", "a");

                        if (body === undefined || memory === undefined || name === undefined) {
                            continue;
                        } else {
                            const result = spawn.spawnCreep(body, name, { memory });

                            if (result !== 0) {
                                room.memory.spawnQueue.unshift(spawnData);
                            }
                        }
                    }
                }
            }
        }
    }
}
