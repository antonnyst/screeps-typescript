import { CreepRole } from "./creepRole";

export class ClaimerRole extends CreepRole {
    runRole() {
        if (this.creep === null || this.creep.memory.roleData === undefined || this.creep.memory.roleData.target === undefined) {
            return;
        }

        if (this.creep.room.name != this.creep.memory.roleData.target) {
            const exit:ExitConstant = this.creep.room.findExitTo(this.creep.memory.roleData.target) as ExitConstant;
            const e = this.creep.pos.findClosestByPath(this.creep.room.find(exit))
            if (e != null) {
                this.smartMove(new RoomPosition(25,25,this.creep.memory.roleData.target));
            }
        } else {
            const controller = this.creep.room.controller;
            if (controller != undefined) {
                if (controller.reservation) {
                    if (this.creep.attackController(controller) === ERR_NOT_IN_RANGE) {
                        this.smartMove(controller.pos,1);
                    }
                } else {
                    if (this.creep.claimController(controller) === ERR_NOT_IN_RANGE) {
                        this.smartMove(controller.pos,1);
                    }
                }                
            }
        }
    }
}