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
            Memory.rooms[this.creep.memory.home].genLayout === undefined ||
            Memory.rooms[this.creep.memory.home].remoteData?.data[this.creep.memory.roleData.target] === undefined
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

        const sourceIndex: string | undefined = this.creep.memory.roleData.targetId;
        if (sourceIndex === undefined) {
            console.log("invalid sourceIndex");
            return;
        }
        const sourceData = Memory.rooms[this.creep.memory.home].remoteData!.data[this.creep.memory.roleData.target]
            .sources[parseInt(sourceIndex, 10)];
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
                    container != null &&
                    container.store.getUsedCapacity() > container.store.getUsedCapacity(RESOURCE_ENERGY)
                ) {
                    this.creep.withdraw(
                        container,
                        _.filter(Object.keys(container.store), (s) => s !== "energy")[0] as ResourceConstant
                    );
                } else if (
                    container !== undefined &&
                    container.store.getUsedCapacity(RESOURCE_ENERGY) >= this.creep.store.getFreeCapacity()
                ) {
                    this.creep.withdraw(container, RESOURCE_ENERGY);
                }
            }
        } else {
            let target: AnyStoreStructure | undefined = undefined;

            if (Memory.rooms[this.creep.memory.home].genBuildings?.storage?.id !== undefined) {
                const storage = Game.getObjectById(Memory.rooms[this.creep.memory.home].genBuildings!.storage.id!);
                if (storage instanceof StructureStorage) {
                    target = storage;
                }
            }

            if (
                target === undefined &&
                Memory.rooms[this.creep.memory.home].genBuildings?.containers[0].id !== undefined
            ) {
                const container = Game.getObjectById(
                    Memory.rooms[this.creep.memory.home].genBuildings!.containers[0].id!
                );
                if (container instanceof StructureContainer && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = container;
                }
            }

            if (target !== undefined) {
                this.setMovementData(target.pos, 1, false, false);
                if (this.creep.pos.isNearTo(target.pos)) {
                    this.creep.transfer(target, Object.keys(this.creep.store)[0] as ResourceConstant);
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
