import * as C from "../../config/constants";

export function RepairHandler(room: Room): void {
    if (Game.time % 5 === 0 && room.controller != undefined && room.controller.my && room.memory.roomLevel === 2) {
        if (room.memory.repairTargets === undefined) {
            room.memory.repairTargets = {};
        }

        for (let s in room.memory.repairTargets) {
            if (Game.getObjectById(s) === null) {
                delete room.memory.repairTargets[s];
            }
        }

        let remoteStructures: Structure[] = [];

        for (let r in room.memory.remotes) {
            const remote: string = room.memory.remotes[r];
            if (Game.rooms[remote] != undefined) {
                remoteStructures = remoteStructures.concat(
                    Game.rooms[remote].find(FIND_STRUCTURES, {
                        filter: (s) => s.hits != undefined && s.structureType != STRUCTURE_WALL
                    })
                );
            }
        }

        const structures: Structure[] = room.find(FIND_STRUCTURES, {
            filter: (s) => s.hits != undefined
        });

        for (let structure of structures) {
            if (structure instanceof StructureWall || structure instanceof StructureRampart) {
                if (
                    structure.hits < 2000 ||
                    (structure.hits < structure.hitsMax * C.RAMPART_PERCENTAGE_MIN &&
                        Object.keys(room.memory.constructionSites).length === 0)
                ) {
                    room.memory.repairTargets[structure.id] = structure.pos;
                } else if (
                    structure.hits > structure.hitsMax * C.RAMPART_PERCENTAGE_MAX ||
                    (Object.keys(room.memory.constructionSites).length > 0 && structure.hits > 2000)
                ) {
                    delete room.memory.repairTargets[structure.id];
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
    }
}
