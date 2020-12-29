import { CreepRole } from "./creepRole";
import { SourceData, RemoteSourceData } from "../dataInterfaces/sourceData";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class RaiderRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.roleData.hasEnergy = true;
        }

        if (this.creep.memory.roleData.hasEnergy === true && this.creep.store.getUsedCapacity() === 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false) {
            if (this.creep.room.name !== this.creep.memory.roleData.target) {
                this.setMovementData(new RoomPosition(25, 25, this.creep.memory.roleData.target), 20, false, false);
            } else {
                const target: StructureStorage = this.creep.room.find(FIND_STRUCTURES, {
                    filter: (s) => s.structureType === STRUCTURE_STORAGE
                })[0] as StructureStorage;

                if (target !== undefined) {
                    this.setMovementData(target.pos, 1, false, false);
                    if (this.creep.pos.isNearTo(target.pos)) {
                        this.creep.withdraw(target, _.findKey(target.store) as ResourceConstant);
                    }
                }
            }
        } else {
            const target: StructureStorage | undefined = Game.rooms[this.creep.memory.home].storage;

            if (target !== undefined) {
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    this.creep.transfer(target, _.findKey(this.creep.store) as ResourceConstant);
                }
            }
        }
    }
}
