import { CreepRole } from "./creepRole";

export class DrainerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }
        const towers = this.creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });
        if (this.creep.getActiveBodyparts(HEAL) > 0 && towers.length > 0) {
            this.creep.heal(this.creep);
        }

        if (this.creep.room.name !== this.creep.memory.roleData.target) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
        } else {
            if (towers.length > 0) {
                if (this.creep.hits < this.creep.hitsMax) {
                    if (this.creep.hits < this.creep.hitsMax - 200) {
                        this.setMovementData(towers[0].pos, 25, true, false);
                    } else {
                        this.cancelMovementData();
                    }
                } else {
                    if (this.creep.hits === this.creep.hitsMax) {
                        this.setMovementData(towers[0].pos, 5, false, false);
                    } else {
                        this.cancelMovementData();
                    }
                }
            }
        }
    }
}
