import { CreepRole } from "./creepRole";
import { saveToCache, getFromCache } from "../utils/Cache";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class FillerRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = { hasEnergy: false };
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
            let target: Structure | null = null;

            if (this.creep.memory.roleData.targetId !== undefined) {
                target = Game.getObjectById(this.creep.memory.roleData.targetId);
            }

            if (target === null) {
                target = this.findTarget();
            }

            if (target != null) {
                this.creep.memory.roleData.targetId = target.id;
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    const res = this.creep.transfer(target, RESOURCE_ENERGY);
                    if (res === OK) {
                        target = this.findTarget(target);
                        if (target !== null) {
                            this.creep.memory.roleData.targetId = target.id;
                            this.setMovementData(target.pos, 1, false, false);
                        }
                    } else {
                        this.creep.memory.roleData.targetId = undefined;
                    }
                }
            } else {
                if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) < 50) {
                    this.creep.memory.roleData.hasEnergy = false;
                    this.getEnergy();
                } else {
                    this.setMovementData(unpackPosition(this.creep.room.memory.layout.baseCenter), 6, false, false);
                }
            }
        }
    }

    findTarget(filter: Structure | undefined = undefined): Structure | null {
        if (this.creep === null) {
            return null;
        }
        let target: Structure | null = null;
        let targets: Structure[] | null = getFromCache("fillerRole.targets." + this.creep.memory.home, 1);
        let usedCache: boolean = true;
        if (targets === null) {
            usedCache = false;
            targets = Game.rooms[this.creep.memory.home].find(FIND_MY_STRUCTURES, {
                filter: (s) =>
                    (s.structureType === STRUCTURE_EXTENSION ||
                        s.structureType === STRUCTURE_SPAWN ||
                        s.structureType === STRUCTURE_TOWER) &&
                    (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0 &&
                    (filter === undefined || s.id !== filter.id)
            });

            if (targets.length === 0 && this.creep.room.memory.linkStatus === "fill") {
                const cPos = unpackPosition(this.creep.room.memory.layout.baseCenter);
                const lPos = new RoomPosition(cPos.x + 1, cPos.y, cPos.roomName);
                targets = Game.rooms[this.creep.memory.home].find(FIND_MY_STRUCTURES, {
                    filter: (s) =>
                        s.structureType === STRUCTURE_LINK &&
                        s.pos.isEqualTo(lPos) &&
                        (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0 &&
                        (filter === undefined || s.id !== filter.id)
                });
            } else if (targets.length === 0 && this.creep.room.memory.linkStatus === "empty") {
                const cPos = unpackPosition(this.creep.room.memory.layout.baseCenter);
                const lPos = new RoomPosition(cPos.x + 1, cPos.y, cPos.roomName);
                const link = Game.rooms[this.creep.memory.home].find(FIND_MY_STRUCTURES, {
                    filter: (s) =>
                        s.structureType === STRUCTURE_LINK &&
                        s.pos.isEqualTo(lPos) &&
                        (filter === undefined || s.id !== filter.id)
                })[0] as StructureLink;

                if (
                    this.creep.room.storage !== undefined &&
                    link !== undefined &&
                    (link.store.getUsedCapacity(RESOURCE_ENERGY) as number) > 0
                ) {
                    targets.push(this.creep.room.storage);
                }
            }

            if (targets.length === 0) {
                targets = null;
            }
        }

        if (targets != null) {
            if (!usedCache) {
                saveToCache("fillerRole.targets." + this.creep.memory.home, targets);
            }
            target = this.creep.pos.findClosestByRange(targets);
        }

        return target;
    }
}
