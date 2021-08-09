import { CreepRole } from "./creepRole";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

declare global {
    interface CreepMemory {
        target?: Id<AnyStoreStructure>;
        targetRoom?: string;
        targetSource?: number;
        working?: boolean;
    }
}

export class RemoteHaulerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.targetRoom === undefined ||
            this.creep.memory.targetSource === undefined ||
            Memory.rooms[this.creep.memory.home].genLayout === undefined ||
            Memory.rooms[this.creep.memory.home].remoteData?.data[this.creep.memory.targetRoom] === undefined
        ) {
            return;
        }

        const sourceIndex: number | undefined = this.creep.memory.targetSource;
        if (sourceIndex === undefined) {
            console.log("invalid sourceIndex");
            return;
        }
        const sourceData = Memory.rooms[this.creep.memory.home].remoteData!.data[this.creep.memory.targetRoom].sources[
            sourceIndex
        ];
        if (sourceData === undefined) {
            console.log("invalid sourceData");
            return;
        }
        const minerPos: RoomPosition = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

        if (this.creep.memory.working === undefined) {
            this.creep.memory.working = false;
        }

        if (this.creep.memory.working === false && this.creep.store.getFreeCapacity() === 0) {
            this.creep.memory.working = true;
        }

        if (this.creep.memory.working === true && this.creep.store.getUsedCapacity() === 0) {
            this.creep.memory.working = false;
            if (this.creep.ticksToLive !== undefined && this.creep.ticksToLive < sourceData.dist * 2) {
                //we do not have enough time to live
                //so we should recycle ourself!
                this.creep.memory.role = "garbage";
                return;
            }
        }

        if (this.creep.memory.working === false) {
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
            let target: AnyStoreStructure | null = null;
            if (this.creep.memory.target !== undefined) {
                target = Game.getObjectById(this.creep.memory.target);
            }

            if (target === null && Memory.rooms[this.creep.memory.home].genBuildings?.storage?.id !== undefined) {
                const storage = Game.getObjectById(Memory.rooms[this.creep.memory.home].genBuildings!.storage.id!);
                if (storage instanceof StructureStorage) {
                    target = storage;
                }
            }

            if (target === null && Memory.rooms[this.creep.memory.home].genBuildings?.containers[0].id !== undefined) {
                const container = Game.getObjectById(
                    Memory.rooms[this.creep.memory.home].genBuildings!.containers[0].id!
                );
                if (container instanceof StructureContainer && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    target = container;
                }
            }

            if (target === null) {
                const targets = Game.rooms[this.creep.memory.home].find(FIND_MY_STRUCTURES, {
                    filter: (s) =>
                        (s.structureType === STRUCTURE_EXTENSION ||
                            s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_TOWER) &&
                        (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
                });
                if (targets.length > 0) {
                    target = targets[0] as AnyStoreStructure;
                }
            }

            if (target !== null) {
                this.setMovementData(target.pos, 1, false, false);
                this.creep.memory.target = target.id;
                if (this.creep.pos.isNearTo(target.pos)) {
                    if (
                        ((target instanceof StructureExtension ||
                            target instanceof StructureSpawn ||
                            target instanceof StructureTower) &&
                            target.store.getFreeCapacity(Object.keys(this.creep.store)[0] as ResourceConstant) === 0) ||
                        ((target instanceof StructureContainer || target instanceof StructureStorage) &&
                            target.store.getFreeCapacity(Object.keys(this.creep.store)[0] as ResourceConstant) === 0)
                    ) {
                        this.creep.memory.target = undefined;
                    } else {
                        this.creep.transfer(target, Object.keys(this.creep.store)[0] as ResourceConstant);
                    }
                }
            } else {
                const cpos = new RoomPosition(
                    this.creep.room.memory.genLayout!.prefabs[0].x,
                    this.creep.room.memory.genLayout!.prefabs[0].y,
                    this.creep.room.name
                );
                this.setMovementData(cpos, 3, true, false);
            }
        }
    }
}
