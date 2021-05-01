import { directionFromEdge, isPositionEdge } from "utils/RoomPositionHelpers";
import { unpackPosition } from "utils/RoomPositionPacker";
import { CreepRole } from "./creepRole";

export class BuilderRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (
            Memory.rooms[this.creep.memory.home] === undefined ||
            Memory.rooms[this.creep.memory.home].layout === undefined
        ) {
            return;
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.roleData.hasEnergy = true;
        }

        if (this.creep.memory.roleData.hasEnergy === true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false) {
            this.getEnergy();
        } else {
            let target: Structure | ConstructionSite | null = Game.getObjectById(
                this.creep.memory.roleData.targetId as string
            );

            if (target === null) {
                target = findTarget(this.creep);
            }

            if (target !== null) {
                if (this.creep.room.name !== target.pos.roomName) {
                    this.setMovementData(target.pos, 0, false, false);
                } else {
                    this.setMovementData(target.pos, 3, false, false);
                }

                if (this.creep.pos.inRangeTo(target.pos, 3)) {
                    if (isPositionEdge(this.creep.pos)) {
                        this.creep.move(directionFromEdge(this.creep.pos));
                    }

                    if (target instanceof ConstructionSite) {
                        this.creep.build(target);
                    } else {
                        if (target.hits === target.hitsMax) {
                            this.creep.memory.roleData.targetId = undefined;
                            target = findTarget(this.creep);
                            if (target !== null) {
                                this.creep.memory.roleData.targetId = target.id;
                                this.setMovementData(target.pos, 3, false, false);
                            }
                        } else {
                            const res = this.creep.repair(target);
                            if (res !== OK || Game.time % 10 === 0) {
                                this.creep.memory.roleData.targetId = undefined;
                            }
                        }
                    }
                }
            } else {
                if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) < 50) {
                    this.creep.memory.roleData.hasEnergy = false;
                    this.getEnergy();
                }
            }
        }
    }
}

function findTarget(creep: Creep): Structure | ConstructionSite | null {
    let target: Structure | ConstructionSite | null = null;

    if (Object.keys(Game.rooms[creep.memory.home].memory.repair).length > 0) {
        let closestTarget: Structure<StructureConstant> | null = null;
        let closestRange: number = Infinity;
        for (const target in Game.rooms[creep.memory.home].memory.repair) {
            const object = Game.getObjectById(Game.rooms[creep.memory.home].memory.repair[target].id);
            if (object !== null) {
                if (object.hits < object.hitsMax) {
                    const range = creep.pos.getRangeTo(object.pos);
                    if (closestTarget === null || range < closestRange) {
                        closestTarget = object;
                        closestRange = range;
                        if (range <= 2) {
                            break;
                        }
                    }
                }
            }
        }

        target = closestTarget;
    }

    if (target === null && Object.keys(Game.rooms[creep.memory.home].memory.constructionSites).length > 0) {
        const tid = Object.keys(Game.rooms[creep.memory.home].memory.constructionSites).sort(
            (a, b) =>
                creep.pos.getRangeTo(
                    new RoomPosition(
                        Game.rooms[creep.memory.home].memory.constructionSites[a].x,
                        Game.rooms[creep.memory.home].memory.constructionSites[a].y,
                        Game.rooms[creep.memory.home].memory.constructionSites[a].roomName
                    )
                ) -
                creep.pos.getRangeTo(
                    new RoomPosition(
                        Game.rooms[creep.memory.home].memory.constructionSites[b].x,
                        Game.rooms[creep.memory.home].memory.constructionSites[b].y,
                        Game.rooms[creep.memory.home].memory.constructionSites[b].roomName
                    )
                )
        )[0];
        target = Game.getObjectById(tid);
    }

    if (target !== null && creep.memory.roleData !== undefined) {
        creep.memory.roleData.targetId = target.id;
        return target;
    }
    return null;
}
