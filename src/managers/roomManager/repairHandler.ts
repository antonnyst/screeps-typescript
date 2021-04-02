import * as C from "../../config/constants";
import { BuildingData } from "./layoutHandler";

export function RepairHandler(room: Room): void {
    if (
        room.controller !== undefined &&
        room.memory.buildings !== undefined &&
        room.controller.my &&
        room.memory.roomLevel === 2
    ) {
        if (room.memory.repairTargets === undefined) {
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
        };
    }
}
