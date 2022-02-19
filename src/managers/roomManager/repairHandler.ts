import { RAMPART_PERCENTAGE_MAX, RAMPART_PERCENTAGE_MIN } from "config/constants";
import { packPosition } from "utils/RoomPositionPacker";
import { BuildingData } from "./layoutHandler";

declare global {
    interface OwnedRoomMemory {
        repair: {
            [id: string]: {
                id: Id<Structure>;
                pos: number;
            };
        };
        repairEnergy: number;
    }
}

const ROAD_REPAIR_THRESHOLD: number = 0.5;
const ADJACENT_ROAD_REPAIR = 5;

export function RepairHandler(room: OwnedRoom): void {
    if (room.memory.genBuildings !== undefined) {
        if (room.memory.repair === undefined) {
            room.memory.repair = {};
        }

        // Check for low ramparts
        let lowRamparts = [];
        for (const rampart of room.memory.genBuildings.ramparts) {
            if (rampart.id !== undefined) {
                // The building exists
                const buildingObject = Game.getObjectById(rampart.id);
                if (
                    !(buildingObject instanceof ConstructionSite) &&
                    buildingObject !== null &&
                    buildingObject !== undefined
                ) {
                    if (buildingObject.hits < 2000) {
                        lowRamparts.push(rampart);
                    }
                }
            }
        }

        if (lowRamparts.length > 0) {
            room.memory.repair = {};
            for (const rampart of lowRamparts) {
                room.memory.repair[rampart.id!] = {
                    id: rampart.id as Id<Structure<StructureConstant>>,
                    pos: rampart.pos
                };
            }
        } else {
            // Roads
            for (let i = 0; i < room.memory.genBuildings.roads.length; i++) {
                const road = room.memory.genBuildings.roads[i];
                if (road.id !== undefined) {
                    const roadObject = Game.getObjectById(road.id);
                    if (roadObject instanceof StructureRoad) {
                        if (
                            roadObject.hits / roadObject.hitsMax < ROAD_REPAIR_THRESHOLD &&
                            room.memory.repair[road.id] === undefined
                        ) {
                            // This road needs repair
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
                        if (roadObject.hits === roadObject.hitsMax && room.memory.repair[road.id] !== undefined) {
                            delete room.memory.repair[road.id];
                        }
                    }
                }
            }

            // All except roads and ramparts
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
                room.memory.genBuildings.extractor,
                room.memory.genBuildings.containers
            );
            for (const building of buildings) {
                if (building.id !== undefined) {
                    // The building exists
                    const buildingObject = Game.getObjectById(building.id);
                    if (
                        !(buildingObject instanceof ConstructionSite) &&
                        buildingObject !== null &&
                        buildingObject !== undefined
                    ) {
                        // The building is an actual structure

                        const buildingPercentage = buildingObject.hits / buildingObject.hitsMax;
                        switch (buildingObject.structureType) {
                            case STRUCTURE_CONTAINER:
                                if (
                                    buildingPercentage < ROAD_REPAIR_THRESHOLD &&
                                    room.memory.repair[buildingObject.id] === undefined
                                ) {
                                    room.memory.repair[buildingObject.id] = {
                                        id: buildingObject.id,
                                        pos: packPosition(buildingObject.pos)
                                    };
                                }
                                break;
                            default:
                                if (buildingPercentage < 1 && room.memory.repair[buildingObject.id] === undefined) {
                                    room.memory.repair[buildingObject.id] = {
                                        id: buildingObject.id,
                                        pos: packPosition(buildingObject.pos)
                                    };
                                }
                                break;
                        }
                        // Stop repairing fully repaired structures
                        if (buildingPercentage >= 1 && room.memory.repair[buildingObject.id] !== undefined) {
                            delete room.memory.repair[buildingObject.id];
                        }

                        if (building.rampart !== undefined && building.rampart.id !== undefined) {
                            // Check the buildings rampart
                            const rampartObject = Game.getObjectById(building.rampart.id);
                            if (rampartObject instanceof StructureRampart) {
                                const rampartPercentage = rampartObject.hits / rampartObject.hitsMax;
                                if (
                                    rampartPercentage < RAMPART_PERCENTAGE_MIN &&
                                    room.memory.repair[rampartObject.id] === undefined
                                ) {
                                    room.memory.repair[rampartObject.id] = {
                                        id: rampartObject.id,
                                        pos: packPosition(rampartObject.pos)
                                    };
                                }
                                if (
                                    rampartPercentage > RAMPART_PERCENTAGE_MAX &&
                                    room.memory.repair[rampartObject.id] !== undefined
                                ) {
                                    delete room.memory.repair[rampartObject.id];
                                }
                            }
                        }
                    }
                }
            }
            let hasRepairs = Object.values(room.memory.repair).length > 0 || room.memory.placedCS.length > 0;

            for (const rampart of room.memory.genBuildings.ramparts) {
                if (rampart.id !== undefined) {
                    // The building exists
                    const buildingObject = Game.getObjectById(rampart.id);
                    if (
                        !(buildingObject instanceof ConstructionSite) &&
                        buildingObject !== null &&
                        buildingObject !== undefined
                    ) {
                        const buildingPercentage = buildingObject.hits / buildingObject.hitsMax;
                        if (
                            !hasRepairs &&
                            buildingPercentage < RAMPART_PERCENTAGE_MIN &&
                            room.memory.repair[buildingObject.id] === undefined
                        ) {
                            room.memory.repair[buildingObject.id] = {
                                id: buildingObject.id,
                                pos: packPosition(buildingObject.pos)
                            };
                            hasRepairs = true;
                        }
                        if (
                            buildingPercentage > RAMPART_PERCENTAGE_MAX &&
                            room.memory.repair[buildingObject.id] !== undefined
                        ) {
                            delete room.memory.repair[buildingObject.id];
                        }
                    }
                }
            }
        }

        let energyNeed = 0;
        for (const id in room.memory.repair) {
            const object = Game.getObjectById(room.memory.repair[id].id);
            if (object !== null) {
                if (object.structureType === STRUCTURE_RAMPART) {
                    energyNeed += (object.hitsMax * RAMPART_PERCENTAGE_MAX - object.hits) / REPAIR_POWER;
                } else {
                    energyNeed += (object.hitsMax - object.hits) * REPAIR_COST;
                }
            } else {
                delete room.memory.repair[id];
            }
        }
        room.memory.repairEnergy = Math.ceil(energyNeed);
    }
}
