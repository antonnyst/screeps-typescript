import { CreepRole } from "./creepRole";
import { packPosition, unpackPosition } from "../utils/RoomPositionPacker";

export class ScoutRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.pos.x === 0) {
            this.creep.move(RIGHT);
        }
        if (this.creep.pos.y === 0) {
            this.creep.move(BOTTOM);
        }
        if (this.creep.pos.x === 49) {
            this.creep.move(LEFT);
        }
        if (this.creep.pos.y === 49) {
            this.creep.move(TOP);
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }
        if (this.creep.memory.roleData.anyStore === undefined) {
            this.creep.memory.roleData.anyStore = {};
        }

        if (
            this.creep.memory.roleData.target !== undefined &&
            this.creep.room.name !== this.creep.memory.roleData.target
        ) {
            let e: RoomPosition | null = null;

            if (this.creep.memory.roleData.anyStore.targetPos !== undefined) {
                e = unpackPosition(this.creep.memory.roleData.anyStore.targetPos);
            }

            if (e === null) {
                const exit: ExitConstant = this.creep.room.findExitTo(
                    this.creep.memory.roleData.target
                ) as ExitConstant;
                e = this.creep.pos.findClosestByRange(this.creep.room.find(exit));
            }

            if (e !== null) {
                const r = this.smartMove(e);

                this.creep.memory.roleData.anyStore.targetPos = packPosition(e);

                if (r !== 0 && r !== ERR_TIRED) {
                    this.creep.memory.roleData.target = undefined;
                    this.creep.memory.roleData.anyStore.targetPos = undefined;
                }
            } else {
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
                if (this.creep.signController(this.creep.room.controller, "") === ERR_NOT_IN_RANGE) {
                    this.smartMove(this.creep.room.controller.pos);
                }
            } else {
                const exits: any = Game.map.describeExits(this.creep.room.name);
                let newTarget: string | undefined;

                for (const e in exits) {
                    if (Memory.rooms[exits[e]] === undefined) {
                        newTarget = exits[e];
                        break;
                    }
                }

                if (newTarget === undefined) {
                    newTarget = exits[Object.keys(exits)[Object.keys(exits).length * Math.random()]];
                }

                this.creep.memory.roleData.target = newTarget;
                if (this.creep.memory.roleData.target !== undefined) {
                    this.smartMove(new RoomPosition(25, 25, this.creep.memory.roleData.target));
                }
            }
        }
    }
}
