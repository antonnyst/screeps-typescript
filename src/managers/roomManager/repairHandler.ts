import { packPosition } from "utils/RoomPositionPacker";
import { BuildingData } from "./layoutHandler";

const ROAD_REPAIR_THRESHOLD: number = 0.5;

const RAMPART_REPAIR_THRESHOLD: number = 0.03;
const RAMPART_MAX_THRESHOLD: number = 0.04;

const BUILDING_REPAIR_THRESHOLD: number = 0.5;

declare global {
    interface RoomMemory {
        repair: {
            [id: string]: {
                id: Id<Structure>;
                pos: number;
            };
        };
    }
}

export function RepairHandler(room: Room): void {
    if (
        room.controller !== undefined &&
        room.memory.buildings !== undefined &&
        room.controller.my &&
        room.memory.roomLevel === 2
    ) {
        /*if (room.memory.repairTargets === undefined) {
            room.memory.repairTargets = {};
        }

        for (const s in room.memory.repairTargets) {
            if (Game.getObjectById(s) === null) {
                delete room.memory.repairTargets[s];
            }
        }

        const buildings: BuildingData<BuildableStructureConstant>[] = (room.memory.buildings.roads.reduce(
            (prev, curr) => {
                return prev.concat(curr);
            },
            []
        ) as BuildingData<BuildableStructureConstant>[]).concat(
            room.memory.buildings.ramparts,
            room.memory.buildings.extensions,
            room.memory.buildings.towers,
            room.memory.buildings.labs,
            room.memory.buildings.links,
            room.memory.buildings.spawns,
            room.memory.buildings.containers,
            room.memory.buildings.storage,
            room.memory.buildings.terminal,
            room.memory.buildings.factory,
            room.memory.buildings.powerspawn,
            room.memory.buildings.nuker,
            room.memory.buildings.observer,
            room.memory.buildings.extractor
        );

        const structures: Structure[] = _.compact(
            buildings.map((value) => {
                if (value.id !== undefined) {
                    const result = Game.getObjectById(value.id);

                    if (result instanceof ConstructionSite) {
                        return null;
                    } else {
                        return result;
                    }
                } else {
                    return null;
                }
            })
        ) as Structure[];

        const ramparts = [];
        const already = [];

        let ramparthitsum = 0;
        let rampartamt = 0;
        let rampartmin = Infinity;
        let rampartmax = 0;

        for (const structure of structures) {
            if (structure instanceof StructureRampart) {
                ramparthitsum += structure.hits;
                rampartamt += 1;
                rampartmin = Math.min(rampartmin, structure.hits);
                rampartmax = Math.max(rampartmax, structure.hits);

                if (room.memory.repairTargets[structure.id] !== undefined) {
                    already.push(structure);
                    delete room.memory.repairTargets[structure.id];
                } else {
                    ramparts.push(structure);
                }
                continue;
            }
            if (structure instanceof StructureRoad || structure instanceof StructureContainer) {
                if (structure.hits < 2000 || structure.hits < structure.hitsMax * 0.5) {
                    room.memory.repairTargets[structure.id] = structure.pos;
                } else if (structure.hits >= structure.hitsMax) {
                    delete room.memory.repairTargets[structure.id];
                }
                continue;
            }
            if (structure.hits < structure.hitsMax) {
                room.memory.repairTargets[structure.id] = structure.pos;
            } else {
                delete room.memory.repairTargets[structure.id];
            }
        }

        const rampartavg = ramparthitsum / rampartamt;

        if (ramparts.length > 0) {
            for (const r of ramparts) {
                if (r.hits < 4000) {
                    room.memory.repairTargets[r.id] = r.pos;
                    continue;
                }
            }

            if (
                Object.keys(room.memory.repairTargets).length === 0 &&
                Object.keys(room.memory.constructionSites).length === 0
            ) {
                let amt = 0;
                for (const r of already) {
                    if (r.hits < r.hitsMax * C.RAMPART_PERCENTAGE_MAX) {
                        room.memory.repairTargets[r.id] = r.pos;
                        amt++;
                        if (amt >= 6) {
                            break;
                        }
                    }
                }
                if (amt < 6) {
                    while (amt < 6 && ramparts.length > 0) {
                        const rampart = _.min(ramparts, (r) => r.hits);
                        ramparts.splice(
                            _.findIndex(ramparts, (r) => r.id === rampart.id),
                            1
                        );
                        if (rampart.hits < rampart.hitsMax * C.RAMPART_PERCENTAGE_MIN) {
                            room.memory.repairTargets[rampart.id] = rampart.pos;
                            amt++;
                        }
                    }
                }
            }
        }

        room.memory.rampartData = {
            rampartavg,
            rampartmin,
            rampartmax
        };*/

        // Repair code :
        // Loop through the buildings memory of the room
        // Roads are repaired on a per branch basis
        // Ramparts are repaired based on lowest hitpoints and focus on singular one until done
        // Containers are repaired when they pass an low threshold until they are fully repaired
        // The rest are repaired if not at full hitpoints

        ///// REMOVE FULLY REPAIRED BUILDINGS AND RAMPARTS /////

        if (room.memory.repair === undefined) {
            room.memory.repair = {};
        }

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

        for (const branch of room.memory.buildings.roads) {
            for (const road of branch) {
                if (road.id !== undefined) {
                    const roadObject = Game.getObjectById(road.id);
                    if (roadObject instanceof StructureRoad) {
                        if (roadObject.hits / roadObject.hitsMax < ROAD_REPAIR_THRESHOLD) {
                            // this roadObject needs repair
                            // add all roadobjects from this branch to repairtargets

                            // first check if this road is already being repaired
                            if (room.memory.repair[road.id] !== undefined) {
                                // this road is already being repaired
                                // stop checking for this road
                                break;
                            }

                            for (const repairTarget of branch) {
                                if (
                                    repairTarget.id === undefined ||
                                    room.memory.repair[repairTarget.id] !== undefined
                                ) {
                                    continue;
                                }
                                const repairTargetObject = Game.getObjectById(repairTarget.id);
                                if (repairTargetObject instanceof StructureRoad) {
                                    if (repairTargetObject.hits < repairTargetObject.hitsMax) {
                                        room.memory.repair[repairTarget.id] = {
                                            id: repairTargetObject.id,
                                            pos: packPosition(repairTargetObject.pos)
                                        };
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            }
        }

        ///// CONTAINERS /////

        for (const container of room.memory.buildings.containers) {
            if (container.id !== undefined && room.memory.repair[container.id] === undefined) {
                const containerObject = Game.getObjectById(container.id);
                if (containerObject instanceof StructureContainer) {
                    if (containerObject.hits / containerObject.hitsMax < ROAD_REPAIR_THRESHOLD) {
                        room.memory.repair[containerObject.id] = {
                            id: containerObject.id,
                            pos: packPosition(containerObject.pos)
                        };
                    }
                }
            }
        }

        ///// THE REST /////

        const buildings: BuildingData<BuildableStructureConstant>[] = (room.memory.buildings
            .extensions as BuildingData<BuildableStructureConstant>[]).concat(
            room.memory.buildings.towers,
            room.memory.buildings.labs,
            room.memory.buildings.links,
            room.memory.buildings.spawns,
            room.memory.buildings.storage,
            room.memory.buildings.terminal,
            room.memory.buildings.factory,
            room.memory.buildings.powerspawn,
            room.memory.buildings.nuker,
            room.memory.buildings.observer,
            room.memory.buildings.extractor
        );
        for (const building of buildings) {
            if (building.id !== undefined && room.memory.repair[building.id] === undefined) {
                const buildingObject = Game.getObjectById(building.id);
                if (!(buildingObject instanceof ConstructionSite) && buildingObject !== null) {
                    if (buildingObject.hits < buildingObject.hitsMax) {
                        room.memory.repair[buildingObject.id] = {
                            id: buildingObject.id,
                            pos: packPosition(buildingObject.pos)
                        };
                    }
                }
            }
        }

        ///// RAMPARTS /////

        if (
            !hasRampart &&
            Object.keys(room.memory.repair).length === 0 &&
            Object.keys(room.memory.constructionSites).length === 0
        ) {
            let lowestRampart: StructureRampart | null = null;
            for (const rampart of room.memory.buildings.ramparts) {
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

            if (lowestRampart !== null) {
                room.memory.repair[lowestRampart.id] = {
                    id: lowestRampart.id,
                    pos: packPosition(lowestRampart.pos)
                };
            }
        } else if (
            hasRampart &&
            (Object.keys(room.memory.repair).length > 1 || Object.keys(room.memory.constructionSites).length > 0)
        ) {
            for (const repairId in room.memory.repair) {
                const object = Game.getObjectById(room.memory.repair[repairId].id);
                if (object !== null && object?.structureType === STRUCTURE_RAMPART) {
                    delete room.memory.repair[repairId];
                }
            }
        }
    }
}
