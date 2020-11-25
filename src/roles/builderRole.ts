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
                if (target instanceof ConstructionSite) {
                    if (this.creep.build(target) === ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 2);
                    } else {
                        if (this.creep.pos.x === 0) {
                            this.creep.move(RIGHT);
                        }
                        if (this.creep.pos.y === 0) {
                            this.creep.move(BOTTOM);
                        }
                        if (this.creep.pos.x === 49) {
                            this.creep.move(LEFT);
                        }
                        if (this.creep.pos.y === 49) {
                            this.creep.move(TOP);
                        }
                    }
                } else {
                    const res = this.creep.repair(target);
                    if (res === ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 2);
                    } else if (res !== OK || Game.time % 20 === 0) {
                        this.creep.memory.roleData.targetId = undefined;
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

    if (Object.keys(Game.rooms[creep.memory.home].memory.repairTargets).length > 0) {
        const tid = Object.keys(Game.rooms[creep.memory.home].memory.repairTargets).sort(
            (a, b) =>
                creep.pos.getRangeTo(
                    new RoomPosition(
                        Game.rooms[creep.memory.home].memory.repairTargets[a].x,
                        Game.rooms[creep.memory.home].memory.repairTargets[a].y,
                        Game.rooms[creep.memory.home].memory.repairTargets[a].roomName
                    )
                ) -
                creep.pos.getRangeTo(
                    new RoomPosition(
                        Game.rooms[creep.memory.home].memory.repairTargets[b].x,
                        Game.rooms[creep.memory.home].memory.repairTargets[b].y,
                        Game.rooms[creep.memory.home].memory.repairTargets[b].roomName
                    )
                )
        )[0];
        target = Game.getObjectById(tid);
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
