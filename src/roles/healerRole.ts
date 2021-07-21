import { CreepRole } from "./creepRole";

export class HealerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }
        let b = false;
        if (this.creep.getActiveBodyparts(HEAL) > 0 && this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
            b = true;
        }
        if (this.creep.getActiveBodyparts(RANGED_ATTACK)) {
            const hostileCreep = this.creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (c) =>
                    c.getActiveBodyparts(RANGED_ATTACK) || c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(HEAL)
            });
            if (hostileCreep !== null) {
                if (hostileCreep.pos.getRangeTo(this.creep.pos) <= 3) {
                    this.creep.rangedAttack(hostileCreep);
                }
            }
        }

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            const target: Creep | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);
            if (target != null) {
                this.setMovementData(target.pos, 1, false, false);
                if (!b) {
                    this.creep.heal(target);
                }
            }
        }
    }
}
