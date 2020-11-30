import { CreepRole } from "./creepRole";

export class ArmedDismantlerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            const exit: ExitConstant = this.creep.room.findExitTo(this.creep.memory.roleData.target) as ExitConstant;
            const e = this.creep.pos.findClosestByRange(this.creep.room.find(exit));
            if (e != null) {
                this.smartMove(e);
            }
        } else {
            const target: Structure | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);

            let b = false;
            if (this.creep.getActiveBodyparts(HEAL) > 0 && this.creep.hits < this.creep.hitsMax) {
                this.creep.heal(this.creep);
                b = true;
            }

            if (target != null) {
                const a = this.creep.pos.isNearTo(target.pos);
                if (!b && !a && this.creep.getActiveBodyparts(HEAL) > 0) {
                    this.creep.heal(this.creep);
                    b = true;
                }

                if (!b && a) {
                    if (a) {
                        this.creep.dismantle(target);
                    }
                }

                if (!this.creep.pos.isNearTo(target.pos)) {
                    this.smartMove(target.pos,1);
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
