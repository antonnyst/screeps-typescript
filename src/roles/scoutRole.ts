import { CreepRole } from "./creepRole";

export class ScoutRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        if (this.creep.memory.roleData.target !== undefined) {
            this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 23, false, false);
            if (this.creep.room.name === this.creep.memory.roleData.target) {
                this.creep.memory.roleData.target = undefined;
            }
        } else {
            if (
                this.creep.room.controller !== undefined &&
                (this.creep.room.controller.my ||
                    (this.creep.room.controller.reservation !== undefined &&
                        this.creep.room.controller.reservation.username ===
                            Game.spawns[Object.keys(Game.spawns)[0]].owner.username)) &&
                this.creep.room.controller.sign !== undefined
            ) {
                this.setMovementData(this.creep.room.controller.pos, 1, false, false);
                if (this.creep.pos.isNearTo(this.creep.room.controller.pos)) {
                    this.creep.signController(this.creep.room.controller, "");
                }
            } else {
                const exits: any = Game.map.describeExits(this.creep.room.name);
                let newTarget: string | undefined;

                for (const e in exits) {
                    if (
                        Game.map.getRoomStatus(exits[e]).status !== Game.map.getRoomStatus(this.creep.room.name).status
                    ) {
                        continue;
                    }
                    if (newTarget === undefined) {
                        newTarget = exits[e];
                    }
                    if (Memory.rooms[exits[e]] === undefined) {
                        newTarget = exits[e];
                        break;
                    }
                    if (Memory.rooms[exits[e]].lastUpdate !== undefined) {
                        if (Memory.rooms[exits[e]].lastUpdate < Memory.rooms[newTarget as string].lastUpdate) {
                            newTarget = exits[e];
                        }
                    }
                }

                this.creep.memory.roleData.target = newTarget;
            }
        }
    }
}
