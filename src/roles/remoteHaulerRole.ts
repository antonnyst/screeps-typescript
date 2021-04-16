import { CreepRole } from "./creepRole";
import { RemoteSourceData } from "../dataInterfaces/sourceData";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class RemoteHaulerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined ||
            Memory.rooms[this.creep.memory.home].layout === undefined ||
            Memory.rooms[this.creep.memory.roleData.target].remoteLayout === undefined
        ) {
            return;
        }

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        if (this.creep.memory.roleData.hasEnergy === false && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.roleData.hasEnergy = true;
        }

        if (this.creep.memory.roleData.hasEnergy === true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }

        const sourceIndex: string | undefined = this.creep.memory.roleData.targetId;
        if (sourceIndex === undefined) {
            console.log("invalid sourceIndex");
            return;
        }
        const sourceData: RemoteSourceData =
            Memory.rooms[this.creep.memory.roleData.target].remoteLayout.sources[parseInt(sourceIndex, 10)];
        if (sourceData === undefined) {
            console.log("invalid sourceData");
            return;
        }
        const minerPos: RoomPosition = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

        if (this.creep.memory.roleData.hasEnergy === false) {
            if (this.creep.ticksToLive !== undefined && this.creep.ticksToLive < sourceData.dist * 2) {
                //we do not have enough time to live
                //so we should recycle ourself!
                this.creep.memory.role = "garbage";
                return;
            }

            this.setMovementData(minerPos, 1, false, false);
            if (this.creep.pos.isNearTo(minerPos)) {
                let container: StructureContainer | null = null;

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
                    this.creep.withdraw(container, RESOURCE_ENERGY);
                }
            }
        } else {
            let target: AnyStoreStructure | undefined = undefined;

            if (Memory.rooms[this.creep.memory.home].buildings?.storage?.id !== undefined) {
                const storage = Game.getObjectById(Memory.rooms[this.creep.memory.home].buildings!.storage.id!);
                if (storage instanceof StructureStorage) {
                    target = storage;
                }
            }

            if (
                target === undefined &&
                Memory.rooms[this.creep.memory.home].buildings?.containers[0].id !== undefined
            ) {
                const container = Game.getObjectById(Memory.rooms[this.creep.memory.home].buildings!.containers[0].id!);
                if (container instanceof StructureContainer) {
                    target = container;
                }
            }

            if (target !== undefined) {
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    this.creep.transfer(target, RESOURCE_ENERGY);
                }
            } else {
                const targets = Game.rooms[this.creep.memory.home].find(FIND_MY_STRUCTURES, {
                    filter: (s) =>
                        (s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_TOWER) &&
                        (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
                });
                if (targets.length > 0) {
                    this.setMovementData(targets[0].pos, 1, false, false);
                    if (this.creep.pos.isNearTo(targets[0].pos)) {
                        this.creep.transfer(targets[0], RESOURCE_ENERGY);
                    }
                }
            }
        }
    }
}
