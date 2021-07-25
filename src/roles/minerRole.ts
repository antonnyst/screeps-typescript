import { CreepRole } from "./creepRole";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class MinerRole extends CreepRole {
    runRole() {
        if (this.creep === null || this.creep.memory.roleData === undefined) {
            return;
        }

        if (this.creep.memory.roleData.anyStore === undefined) {
            this.creep.memory.roleData.anyStore = {};
        }

        const sourceIndex: string | undefined = this.creep.memory.roleData.targetId;
        if (sourceIndex === undefined) {
            console.log("invalid sourceIndex");
            return;
        }

        const sourceData = Memory.rooms[this.creep.memory.home].genLayout!.sources[parseInt(sourceIndex, 10)];
        const basicSourceData = Memory.rooms[this.creep.memory.home].basicRoomData.sources[parseInt(sourceIndex, 10)];
        if (sourceData === undefined || basicSourceData === undefined) {
            console.log("invalid sourceData");
            return;
        }

        const minerPos: RoomPosition = offsetPositionByDirection(
            unpackPosition(basicSourceData.pos),
            sourceData.container
        );

        const source: Source | null = Game.getObjectById(basicSourceData.id);
        if (source === null) {
            console.log("invalid source");
            return;
        }

        this.setMovementData(minerPos, 0, false, true);

        if (this.creep.pos.isEqualTo(minerPos)) {
            if (this.creep.getActiveBodyparts(CARRY) > 0 && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                /*if (sourceData.extensions.length > 0 && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
                    if (this.creep.memory.roleData.anyStore.extensionId === undefined) {
                        this.creep.memory.roleData.anyStore.extensionId = [];
                    }
                    for (const i of sourceData.extensions) {
                        const extension: Structure | null =
                            this.creep.memory.roleData.anyStore.extensionId[i] === undefined
                                ? _.filter(
                                      offsetPositionByDirection(minerPos, i).lookFor(LOOK_STRUCTURES),
                                      (s: Structure) => s.structureType === STRUCTURE_EXTENSION
                                  )[0]
                                : Game.getObjectById(this.creep.memory.roleData.anyStore.extensionId[i]);
                        if (
                            extension instanceof StructureExtension &&
                            extension.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                        ) {
                            this.creep.transfer(extension, RESOURCE_ENERGY);
                        }
                    }
                }*/

                const container: StructureContainer | null =
                    this.creep.memory.roleData.anyStore.containerId === undefined
                        ? (_.filter(
                              minerPos.lookFor(LOOK_STRUCTURES),
                              (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                          )[0] as StructureContainer)
                        : Game.getObjectById(this.creep.memory.roleData.anyStore.containerId);

                if (container !== undefined && container !== null) {
                    this.creep.memory.roleData.anyStore.containerId = container.id;
                }

                if (container !== undefined && container !== null && container.hits < container.hitsMax) {
                    this.creep.repair(container);
                }

                if (
                    container !== undefined &&
                    container !== null &&
                    this.creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 20
                ) {
                    this.creep.withdraw(container, RESOURCE_ENERGY);
                }

                if (
                    container === undefined ||
                    container === null ||
                    this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ||
                    container.store.getFreeCapacity(RESOURCE_ENERGY) >= this.creep.getActiveBodyparts(WORK) * 5
                ) {
                    this.creep.harvest(source);
                }

                if (this.creep.room.controller && this.creep.room.controller.level > 5) {
                    const link: StructureLink | null =
                        this.creep.memory.roleData.anyStore.linkId === undefined
                            ? (_.filter(
                                  offsetPositionByDirection(minerPos, sourceData.link).lookFor(LOOK_STRUCTURES),
                                  (s: Structure) => s.structureType === STRUCTURE_LINK
                              )[0] as StructureLink)
                            : Game.getObjectById(this.creep.memory.roleData.anyStore.linkId);

                    if (link !== undefined && link !== null) {
                        this.creep.memory.roleData.anyStore.linkId = link.id;
                        if (
                            (link.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0 &&
                            this.creep.store.getUsedCapacity(RESOURCE_ENERGY) >=
                                50 - this.creep.getActiveBodyparts(WORK) * 2
                        ) {
                            this.creep.transfer(link, RESOURCE_ENERGY);
                        }
                    }
                }
            } else {
                this.creep.harvest(source);
            }
        }
    }
}
