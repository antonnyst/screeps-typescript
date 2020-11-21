import { CreepRole } from "./creepRole";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class UpgraderRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.room.controller!.level >= 7) {
            const cpos = unpackPosition(this.creep.room.memory.layout.controllerStore);
            if (this.creep.pos.isNearTo(cpos)) {
                if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= this.creep.getActiveBodyparts(WORK)) {
                    const link = _.filter(
                        unpackPosition(this.creep.room.memory.layout.controllerStore).lookFor(LOOK_STRUCTURES),
                        (s: Structure) => s.structureType === STRUCTURE_LINK
                    )[0];

                    if (link !== undefined) {
                        this.creep.withdraw(link, RESOURCE_ENERGY);
                    }
                }
                this.creep.upgradeController(this.creep.room.controller!);
            } else {
                this.smartMove(cpos);
            }
        } else {
            if (this.creep.memory.roleData === undefined) {
                this.creep.memory.roleData = {};
            }

            if (this.creep.memory.roleData.hasEnergy === undefined) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy === false && this.creep.store.getFreeCapacity() === 0) {
                this.creep.memory.roleData.hasEnergy = true;
            }

            if (
                this.creep.memory.roleData.hasEnergy === true &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0
            ) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy === false) {
                this.getEnergy();
            } else {
                const controller: StructureController | undefined = Game.rooms[this.creep.memory.home].controller;
                if (controller !== undefined && this.creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                    this.smartMove(controller.pos);
                }
            }
        }
    }
}
