import { packPosition } from "utils/RoomPositionPacker";
import { BuildingData } from "./layoutHandler";

declare global {
    interface RoomMemory {
        repair: {
            [id: string]: {
                id: Id<Structure>;
                pos: number;
            };
        };
        rampartTargets: number;
    }
}

const ROAD_REPAIR_THRESHOLD: number = 0.5;
const ADJACENT_ROAD_REPAIR = 5;

const RAMPART_REPAIR_THRESHOLD: number = 0.03;
const RAMPART_MAX_THRESHOLD: number = 0.04;

export function RepairHandler(room: Room): void {
    if (
        room.controller !== undefined &&
        room.memory.genBuildings !== undefined &&
        room.controller.my &&
        room.memory.roomLevel === 2
    ) {
        // Repair code :
        // Loop through the buildings memory of the room
        // Roads are repaired on a per branch basis
        // Ramparts are repaired based on lowest hitpoints and focus on singular one until done
        // Containers are repaired when they pass an low threshold until they are fully repaired
        // The rest are repaired if not at full hitpoints

        if (room.memory.repair === undefined) {
            room.memory.repair = {};
        }

        ///// REMOVE FULLY REPAIRED BUILDINGS AND RAMPARTS /////

        let hasRampart: boolean = false;
        // Indicator to not add a rampart to repairtargets

        for (const repairId in room.memory.repair) {
            const object = Game.getObjectById(room.memory.repair[repairId].id);
            if (
                object === null ||
                object.hits === object.hitsMax ||
                (object.structureType === STRUCTURE_RAMPART && object.hits / object.hitsMax > RAMPART_MAX_THRESHOLD)
            ) {
                delete room.memory.repair[repairId];
            } else if (!hasRampart && object !== null && object.structureType === STRUCTURE_RAMPART) {
                hasRampart = true;
            }
        }

        ///// ROADS /////
        for (let i = 0; i < room.memory.genBuildings.roads.length; i++) {
            const road = room.memory.genBuildings.roads[i];
            if (road.id !== undefined) {
                const roadObject = Game.getObjectById(road.id);
                if (roadObject instanceof StructureRoad) {
                    if (roadObject.hits / roadObject.hitsMax < ROAD_REPAIR_THRESHOLD) {
                        // this road needs repair
                        // Also repair adjacent roads
                        for (let d = -ADJACENT_ROAD_REPAIR; d <= ADJACENT_ROAD_REPAIR; d++) {
                            if (i + d < 0 || i + d >= room.memory.genBuildings.roads.length) {
                                continue;
                            }
                            const r = room.memory.genBuildings.roads[i + d];
                            if (r.id !== undefined) {
                                const ro = Game.getObjectById(r.id);
                                if (ro instanceof StructureRoad) {
                                    if (ro.hits < ro.hitsMax) {
                                        room.memory.repair[ro.id] = room.memory.repair[ro.id] || {
                                            id: ro.id,
                                            pos: packPosition(ro.pos)
                                        };
                                    }
                                }
                            }
                        }

                        break;
                    }
                }
            }
        }

        ///// CONTAINERS /////

        for (const container of room.memory.genBuildings.containers) {
            if (container.id !== undefined && room.memory.repair[container.id] === undefined) {
                const containerObject = Game.getObjectById(container.id);
                if (containerObject instanceof StructureContainer) {
                    if (containerObject.hits / containerObject.hitsMax < ROAD_REPAIR_THRESHOLD) {
                        room.memory.repair[containerObject.id] = room.memory.repair[containerObject.id] || {
                            id: containerObject.id,
                            pos: packPosition(containerObject.pos)
                        };
                    }
                }
            }
        }

        ///// THE REST /////

        const buildings: BuildingData[] = (room.memory.genBuildings.extensions as BuildingData[]).concat(
            room.memory.genBuildings.towers,
            room.memory.genBuildings.labs,
            room.memory.genBuildings.links,
            room.memory.genBuildings.spawns,
            room.memory.genBuildings.storage,
            room.memory.genBuildings.terminal,
            room.memory.genBuildings.factory,
            room.memory.genBuildings.powerspawn,
            room.memory.genBuildings.nuker,
            room.memory.genBuildings.observer,
            room.memory.genBuildings.extractor
        );
        for (const building of buildings) {
            if (building.id !== undefined && room.memory.repair[building.id] === undefined) {
                const buildingObject = Game.getObjectById(building.id);
                if (
                    !(buildingObject instanceof ConstructionSite) &&
                    buildingObject !== null &&
                    buildingObject !== undefined
                ) {
                    if (buildingObject.hits < buildingObject.hitsMax) {
                        room.memory.repair[buildingObject.id] = room.memory.repair[buildingObject.id] || {
                            id: buildingObject.id,
                            pos: packPosition(buildingObject.pos)
                        };
                    }
                }
            }
        }

        ///// RAMPARTS /////
        room.memory.rampartTargets = 0;
        for (const rampart of room.memory.genBuildings.ramparts) {
            if (rampart.id !== undefined) {
                const rampartObject = Game.getObjectById(rampart.id);
                if (rampartObject instanceof StructureRampart) {
                    if (rampartObject.hits < 2000) {
                        room.memory.repair[rampartObject.id] = room.memory.repair[rampartObject.id] || {
                            id: rampartObject.id,
                            pos: packPosition(rampartObject.pos)
                        };
                    } else if (rampartObject.hits / rampartObject.hitsMax < RAMPART_REPAIR_THRESHOLD) {
                        room.memory.rampartTargets++;
                    }
                }
            }
        }
        for (const building of buildings) {
            if (building.rampart !== undefined && building.rampart.id !== undefined) {
                const rampartObject = Game.getObjectById(building.rampart.id);
                if (rampartObject instanceof StructureRampart) {
                    if (rampartObject.hits < 2000) {
                        room.memory.repair[rampartObject.id] = room.memory.repair[rampartObject.id] || {
                            id: rampartObject.id,
                            pos: packPosition(rampartObject.pos)
                        };
                    } else if (rampartObject.hits / rampartObject.hitsMax < RAMPART_REPAIR_THRESHOLD) {
                        room.memory.rampartTargets++;
                    }
                }
            }
        }

        if (!hasRampart && Object.keys(room.memory.repair).length === 0 && room.memory.placedCS.length === 0) {
            let lowestRampart: StructureRampart | null = null;
            for (const rampart of room.memory.genBuildings.ramparts) {
                if (rampart.id !== undefined) {
                    const rampartObject = Game.getObjectById(rampart.id);
                    if (rampartObject instanceof StructureRampart) {
                        if (
                            rampartObject.hits / rampartObject.hitsMax < RAMPART_REPAIR_THRESHOLD &&
                            (lowestRampart == null || rampartObject.hits < lowestRampart.hits)
                        ) {
                            lowestRampart = rampartObject;
                        }
                    }
                }
            }
            for (const building of buildings) {
                if (building.rampart !== undefined && building.rampart.id !== undefined) {
                    const rampartObject = Game.getObjectById(building.rampart.id);
                    if (rampartObject instanceof StructureRampart) {
                        if (
                            rampartObject.hits / rampartObject.hitsMax < RAMPART_REPAIR_THRESHOLD &&
                            (lowestRampart == null || rampartObject.hits < lowestRampart.hits)
                        ) {
                            lowestRampart = rampartObject;
                        }
                    }
                }
            }

            if (lowestRampart !== null) {
                room.memory.repair[lowestRampart.id] = room.memory.repair[lowestRampart.id] || {
                    id: lowestRampart.id,
                    pos: packPosition(lowestRampart.pos)
                };
            }
        } else if (hasRampart && (Object.keys(room.memory.repair).length > 1 || room.memory.placedCS.length > 0)) {
            for (const repairId in room.memory.repair) {
                const object = Game.getObjectById(room.memory.repair[repairId].id);
                if (object !== null && object.structureType === STRUCTURE_RAMPART) {
                    delete room.memory.repair[repairId];
                }
            }
        }
    }
}
