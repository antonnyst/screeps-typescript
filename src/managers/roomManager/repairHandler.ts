import * as C from "../../config/constants";

export function RepairHandler(room: Room): void {
    if (room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        if (room.memory.repairTargets === undefined) {
            room.memory.repairTargets = {};
        }

        for (const s in room.memory.repairTargets) {
            if (Game.getObjectById(s) === null) {
                delete room.memory.repairTargets[s];
            }
        }

        let remoteStructures: Structure[] = [];

        for (const r in room.memory.remotes) {
            const remote: string = room.memory.remotes[r];
            if (Game.rooms[remote] !== undefined) {
                remoteStructures = remoteStructures.concat(
                    Game.rooms[remote].find(FIND_STRUCTURES, {
                        filter: (s) =>
                            s.hits !== undefined &&
                            s.structureType !== STRUCTURE_WALL &&
                            s.structureType !== STRUCTURE_INVADER_CORE
                    })
                );
            }
        }

        const structures: Structure[] = remoteStructures.concat(
            room.find(FIND_STRUCTURES, {
                filter: (s) => s.hits !== undefined
            })
        );

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
                    ramparts.sort((a, b) => a.hits - b.hits);
                    for (const r of ramparts) {
                        if (r.hits < r.hitsMax * C.RAMPART_PERCENTAGE_MIN) {
                            room.memory.repairTargets[r.id] = r.pos;
                            amt++;
                            if (amt >= 6) {
                                break;
                            }
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
