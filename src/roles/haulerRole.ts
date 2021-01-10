import { CreepRole } from "./creepRole";
import { SourceData } from "../dataInterfaces/sourceData";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class HaulerRole extends CreepRole {
    runRole() {
        if (this.creep === null || this.creep.memory.roleData === undefined) {
            return;
        }

        const sourceIndex: string | undefined = this.creep.memory.roleData.targetId;
        if (sourceIndex === undefined) {
            console.log("invalid sourceIndex");
            return;
        }
        const sourceData: SourceData = Memory.rooms[this.creep.memory.home].layout.sources[parseInt(sourceIndex, 10)];
        if (sourceData === undefined) {
            console.log("invalid sourceData");
            return;
        }
        const minerPos: RoomPosition = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.roleData.hasEnergy = true;
        }

        if (this.creep.memory.roleData.hasEnergy === true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false) {
            this.setMovementData(minerPos, 1, false, false);

            // get from designated source
            if (this.creep.pos.isNearTo(minerPos)) {
                let container: StructureContainer | null = null;

                if (this.creep.memory.roleData.target !== undefined) {
                    container = Game.getObjectById(this.creep.memory.roleData.target) as StructureContainer;
                }

                if (container === null) {
                    container = _.filter(
                        minerPos.lookFor(LOOK_STRUCTURES),
                        (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                    )[0] as StructureContainer;
                }

                if (
                    container !== undefined &&
                    container.store.getUsedCapacity(RESOURCE_ENERGY) >= this.creep.store.getFreeCapacity()
                ) {
                    this.creep.memory.roleData.target = container.id;
                    this.creep.withdraw(container, RESOURCE_ENERGY);
                }
            }
        } else {
            const container: StructureContainer = _.filter(
                unpackPosition(Memory.rooms[this.creep.memory.home].layout.controllerStore).lookFor(LOOK_STRUCTURES),
                (s: Structure) => s.structureType === STRUCTURE_CONTAINER
            )[0] as StructureContainer;
            let target: StructureContainer | StructureStorage | StructureLink | null = null;

            if (container != null && container.store.getFreeCapacity(RESOURCE_ENERGY) > CONTAINER_CAPACITY * 0.25) {
                target = container;
            }

            if (target === null && this.creep.room.storage !== undefined) {
                if (this.creep.room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 100000) {
                    const cpos = unpackPosition(Memory.rooms[this.creep.memory.home].layout.baseCenter);
                    const link: StructureLink = _.filter(
                        new RoomPosition(cpos.x + 1, cpos.y, cpos.roomName).lookFor(LOOK_STRUCTURES),
                        (s: Structure) => s.structureType === STRUCTURE_LINK
                    )[0] as StructureLink;

                    if (link != null && (link.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0) {
                        target = link;
                    }
                }
                if (target === null) {
                    target = this.creep.room.storage;
                }
            }

            if (target != null) {
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    this.creep.transfer(target, RESOURCE_ENERGY);
                }
            }
        }
    }
}
