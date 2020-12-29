import { CreepRole } from "./creepRole";

export class ClaimerRole extends CreepRole {
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
            const controller = this.creep.room.controller;
            if (controller !== undefined) {
                this.setMovementData(controller.pos, 1, false, false);
                if (this.creep.pos.isNearTo(controller.pos)) {
                    if (controller.reservation || (controller.owner !== undefined && !controller.my)) {
                        this.creep.attackController(controller);
                    } else {
                        this.creep.claimController(controller);
                    }
                }
            }
        }
    }
}
