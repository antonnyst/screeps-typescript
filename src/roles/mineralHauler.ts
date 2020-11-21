import { CreepRole } from "./creepRole";
import { SourceData } from "../dataInterfaces/sourceData";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class MineralHaulerRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (
            this.creep.memory.roleData.hasEnergy == false &&
            (this.creep.store.getFreeCapacity() == 0 || this.creep.room.find(FIND_MINERALS)[0].mineralAmount === 0)
        ) {
            this.creep.memory.roleData.hasEnergy = true;
        }

        if (this.creep.memory.roleData.hasEnergy == true && this.creep.store.getUsedCapacity() == 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        const minerPos = offsetPositionByDirection(
            unpackPosition(Memory.rooms[this.creep.memory.home].layout.mineral.pos),
            Memory.rooms[this.creep.memory.home].layout.mineral.container
        );
        const res = (Game.getObjectById(Memory.rooms[this.creep.memory.home].layout.mineral.id) as Mineral).mineralType;

        if (this.creep.memory.roleData.hasEnergy === false) {
            //get from designated source
            if (this.creep.pos.isNearTo(minerPos)) {
                let container: StructureContainer | null = null;

                if (this.creep.memory.roleData.target != undefined) {
                    container = Game.getObjectById(this.creep.memory.roleData.target) as StructureContainer;
                }

                if (container === null) {
                    container = _.filter(
                        minerPos.lookFor(LOOK_STRUCTURES),
                        (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                    )[0] as StructureContainer;
                }

                if (
                    container != undefined &&
                    container.store.getUsedCapacity(res) >= this.creep.store.getCapacity() &&
                    this.creep.ticksToLive! > 50
                ) {
                    this.creep.memory.roleData.target = container.id;
                    this.creep.withdraw(container, res);
                }
            } else {
                this.smartMove(minerPos);
            }
        } else {
            const target = this.creep.room.terminal;

            if (target != undefined) {
                if (this.creep.transfer(target, res) == ERR_NOT_IN_RANGE) {
                    this.smartMove(target.pos, 1);
                }
            }
        }
    }
}
