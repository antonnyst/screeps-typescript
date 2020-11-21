import { CreepRole } from "./creepRole";

export class DismantlerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }

        if (this.creep.room.name != this.creep.memory.roleData.target) {
            const exit: ExitConstant = this.creep.room.findExitTo(this.creep.memory.roleData.target) as ExitConstant;
            const e = this.creep.pos.findClosestByRange(this.creep.room.find(exit));
            if (e != null) {
                this.smartMove(e);
            }
        } else {
            const target: Structure | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);
            if (target != null) {
                if (this.creep.dismantle(target) === ERR_NOT_IN_RANGE) {
                    this.smartMove(target.pos);
                }
            } else {
                const t = this.creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES);

                if (t != null) {
                    this.creep.memory.roleData.targetId = t.id;
                }
            }
        }
    }
}
