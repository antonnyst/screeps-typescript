import { CreepRole } from "./creepRole";
import { RemoteSourceData } from "../dataInterfaces/sourceData";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class RemoteMinerRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined ||
            Memory.rooms[this.creep.memory.home].remoteData?.data[this.creep.memory.roleData.target] === undefined
        ) {
            return;
        }

        if (this.creep.getActiveBodyparts(WORK) === 0) {
            this.creep.suicide();
            return;
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

        this.setMovementData(minerPos, 0, false, true);
        if (this.creep.pos.isEqualTo(minerPos)) {
            const source: Source | null = Game.getObjectById(sourceData.id);
            if (source === null) {
                console.log("invalid source");
                return;
            }

            const container: StructureContainer = _.filter(
                minerPos.lookFor(LOOK_STRUCTURES),
                (s: Structure) => s.structureType === STRUCTURE_CONTAINER
            )[0] as StructureContainer;

            if (
                container === undefined ||
                this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 ||
                container.store.getFreeCapacity(RESOURCE_ENERGY) >= this.creep.getActiveBodyparts(WORK) * 5
            ) {
                this.creep.harvest(source);
            }
            if (this.creep.getActiveBodyparts(CARRY) > 0 && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (container !== undefined && container.hits < container.hitsMax) {
                    this.creep.repair(container);
                    if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) < 20) {
                        this.creep.withdraw(container, RESOURCE_ENERGY);
                    }
                }
                if (container === undefined) {
                    minerPos.createConstructionSite(STRUCTURE_CONTAINER);

                    const site = _.filter(
                        minerPos.lookFor(LOOK_CONSTRUCTION_SITES),
                        (s: Structure) => s.structureType === STRUCTURE_CONTAINER
                    )[0];
                    if (site !== undefined) {
                        this.creep.build(site);
                    }
                }
            }
        }
    }
}
