import { CreepRole } from "./creepRole";
import { SourceData } from "../dataInterfaces/sourceData";
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

        const sourceData: SourceData = Memory.rooms[this.creep.memory.home].layout.sources[parseInt(sourceIndex, 10)];
        if (sourceData === undefined) {
            console.log("invalid sourceData");
            return;
        }

        const minerPos: RoomPosition = offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container);

        const source: Source | null = Game.getObjectById(sourceData.id);
        if (source === null) {
            console.log("invalid source");
            return;
        }

        if (this.creep.pos.isEqualTo(minerPos)) {
            this.creep.harvest(source);

            if (this.creep.memory.checkIdle !== undefined) {
                this.creep.memory.checkIdle.idleCount = 1;
            }

            if (this.creep.getActiveBodyparts(CARRY) > 0 && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                const container: Structure | null =
                    this.creep.memory.roleData.anyStore.containerId === undefined
                        ? _.filter(
                              minerPos.lookFor(LOOK_STRUCTURES),
                              (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                          )[0]
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
            }
        } else {
            this.smartMove(minerPos);
        }
    }
}
