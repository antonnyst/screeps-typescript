import { CreepRole } from "./creepRole";

export class BlinkerRole extends CreepRole {
    runRole() {
        if (this.creep === null || this.creep.memory.roleData === undefined || this.creep.memory.roleData.target === undefined) {
            return;
        }

        if (this.creep.getActiveBodyparts(HEAL) > 0) {
            this.creep.heal(this.creep);
        }

        if (this.creep.room.name != this.creep.memory.roleData.target) {
            const exit:ExitConstant = this.creep.room.findExitTo(this.creep.memory.roleData.target) as ExitConstant;
            const e = this.creep.pos.findClosestByRange(this.creep.room.find(exit))
            if (e != null) {
                this.smartMove(e);
            }
        } else {
            const target:Structure|Creep|null = Game.getObjectById(this.creep.memory.roleData.targetId as string);
            if (target != null) {
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
                    this.smartMove(target.pos,3);
                }
                
            } else {
                const t = this.creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter:(s)=>(s.structureType !== STRUCTURE_STORAGE || (s.structureType === STRUCTURE_STORAGE && s.store.getUsedCapacity() === 0))});

                if (t != null) {
                    this.creep.memory.roleData.targetId = t.id;
                }
            }
        }
    }
}