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

        if (this.creep.getActiveBodyparts(HEAL) > 0) {
            this.creep.heal(this.creep);
        }

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            const target: Structure | Creep | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);
            if (target != null) {
                this.setMovementData(target.pos, 3, false, false);

                const r = this.creep.pos.getRangeTo(target.pos);
                if (r <= 3) {
                    const t = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (t != null && this.creep.pos.getRangeTo(t.pos) <= 3) {
                        this.creep.rangedAttack(t);
                    } else {
                        this.creep.rangedAttack(target);
                    }
                    //
                } else {
                    const t = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                    if (t != null) {
                        this.creep.rangedAttack(t);
                    }
                }
            } else {
                const t = this.creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {
                    filter: (s) =>
                        s.structureType !== STRUCTURE_STORAGE ||
                        (s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity() === 0)
                });

                if (t != null) {
                    this.creep.memory.roleData.targetId = t.id;
                }
            }
        }
    }
}
