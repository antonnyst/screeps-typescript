import { CreepRole } from "./creepRole";

export class BlinkerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }
        const hostileCreeps = this.creep.room.find(FIND_HOSTILE_CREEPS);
        let a = false;

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            if (this.creep.hits === this.creep.hitsMax) {
                const nearbyFriendly = this.creep.room.find(FIND_MY_CREEPS, {
                    filter: (c) => this.creep?.pos.getRangeTo(c.pos) === 1 && c.hits < c.hitsMax
                });
                if (nearbyFriendly.length > 0) {
                    a = true;
                    this.creep.heal(nearbyFriendly[0]);
                }
            }
            const target: Structure | Creep | ConstructionSite | null = Game.getObjectById(
                this.creep.memory.roleData.targetId as string
            );
            if (target != null) {
                if (target instanceof ConstructionSite) {
                    this.setMovementData(target.pos, 0, false, false);
                    if (target.pos.getRangeTo(this.creep.pos.x, this.creep.pos.y) === 0) {
                        this.setMovementData(target.pos, 1, true, false);
                    }
                } else {
                    if (this.creep.memory.roleData.anyStore.wait > 0) {
                        const nearbyFriendly = this.creep.room.find(FIND_MY_CREEPS, {
                            filter: (c) => this.creep?.pos.getRangeTo(c.pos) === 1 && c.hits < c.hitsMax
                        });
                        if (
                            nearbyFriendly.length >= this.creep.memory.roleData.anyStore.wait &&
                            this.creep.hits === this.creep.hitsMax
                        ) {
                            this.setMovementData(target.pos, 3, false, false);
                        } else {
                            this.cancelMovementData();
                        }
                    } else {
                        this.setMovementData(target.pos, 3, false, false);
                    }
                }

                const r = this.creep.pos.getRangeTo(target.pos);
                if (r <= 3) {
                    const t = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (t != null && this.creep.pos.getRangeTo(t.pos) <= 3) {
                        this.creep.rangedAttack(t);
                    } else {
                        if (!(target instanceof ConstructionSite)) {
                            this.creep.rangedAttack(target);
                        }
                    }
                } else {
                    const t = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (t != null) {
                        this.creep.rangedAttack(t);
                    }
                }
            } else {
                const t = this.creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
                    filter: (s) =>
                        (s.structureType !== STRUCTURE_STORAGE ||
                            (s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity() === 0)) &&
                        s.hits !== undefined
                });

                if (t != null) {
                    this.creep.memory.roleData.targetId = t.id;
                } else {
                    const hc = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (hc !== null) {
                        this.creep.memory.roleData.targetId = hc.id;
                    } else {
                        const cs = this.creep.pos.findClosestByRange(FIND_HOSTILE_CONSTRUCTION_SITES, {
                            filter: (site) => {
                                return site.progress > 0;
                            }
                        });
                        if (cs !== null) {
                            this.creep.memory.roleData.targetId = cs.id;
                        }
                    }
                }
            }
        }
        if (a === false && this.creep.getActiveBodyparts(HEAL) > 0 && hostileCreeps.length > 0) {
            this.creep.heal(this.creep);
        }
    }
}
