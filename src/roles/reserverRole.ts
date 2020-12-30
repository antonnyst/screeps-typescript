import { CreepRole } from "./creepRole";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class ReserverRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }

        const cPos = unpackPosition(Memory.rooms[this.creep.memory.roleData.target].basicLayout.controller);
        this.setMovementData(cPos, 1, false, false);
        if (this.creep.pos.isNearTo(cPos)) {
            if (this.creep.room.controller !== undefined) {
                if (this.creep.room.controller.sign !== undefined) {
                    this.creep.signController(this.creep.room.controller, "");
                }

                if (
                    this.creep.room.controller.reservation !== undefined &&
                    this.creep.room.controller.reservation.username !==
                        Game.spawns[Object.keys(Game.spawns)[0]].owner.username
                ) {
                    this.creep.attackController(this.creep.room.controller);
                } else {
                    this.creep.reserveController(this.creep.room.controller);
                }
            }
        }
    }
}
