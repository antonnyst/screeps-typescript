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

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            const target: Structure | null = Game.getObjectById(this.creep.memory.roleData.targetId as string);
            if (target != null) {
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    this.creep.dismantle(target);
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
