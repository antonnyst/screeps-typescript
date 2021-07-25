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
        let b = false;
        if (this.creep.getActiveBodyparts(HEAL) > 0 && this.creep.hits < this.creep.hitsMax) {
            this.creep.heal(this.creep);
            b = true;
        }
        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            const target: Structure | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);

            if (target != null) {
                this.setMovementData(target.pos, 1, false, false);

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
