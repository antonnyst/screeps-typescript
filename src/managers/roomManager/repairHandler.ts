import { RunEvery } from "utils/RunEvery";
import * as C from "../../config/constants";

export function RepairHandler(room: Room): void {
    RunEvery(
        () => {
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

                for (const structure of structures) {
                    if (structure instanceof StructureRampart) {
                        if (structure.hits < 4000) {
                            room.memory.repairTargets[structure.id] = structure.pos;
                        } else {
                            delete room.memory.repairTargets[structure.id];
                            ramparts.push(structure);
                        }
                        continue;
                    }
                    if (structure instanceof StructureRoad || structure instanceof StructureContainer) {
                        if (structure.hits < 2000 || structure.hits < structure.hitsMax * 0.75) {
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

                if (
                    Object.keys(room.memory.repairTargets).length === 0 &&
                    ramparts.length > 0 &&
                    Object.keys(room.memory.constructionSites).length === 0
                ) {
                    let amt = 0;
                    for (const r of ramparts) {
                        if (r.hits < C.RAMPART_PERCENTAGE_MIN * r.hitsMax && amt < 6) {
                            room.memory.repairTargets[r.id] = r.pos;
                            amt++;
                        }
                    }
                }
            }
        },
        "repairhandlermain" + room.name,
        5
    );
}
