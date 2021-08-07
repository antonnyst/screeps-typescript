import { BuildingData } from "managers/roomManager/layoutHandler";
import { unpackPosition } from "utils/RoomPositionPacker";
import { CreepRole } from "./creepRole";

declare global {
    interface CreepMemory {
        targetPos?: number;
    }
}

export class QuickFiller extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.targetPos !== undefined) {
            this.setMovementData(unpackPosition(this.creep.memory.targetPos), 0, false, true);
            if (unpackPosition(this.creep.memory.targetPos).isEqualTo(this.creep.pos)) {
                this.creep.memory.targetPos = undefined;
            }
        } else {
            const targets: (StructureExtension | StructureSpawn)[] = GetEnergyBuildings(
                Memory.rooms[this.creep.memory.home].genBuildings!.spawns,
                this.creep.pos
            ).concat(
                GetEnergyBuildings(Memory.rooms[this.creep.memory.home].genBuildings!.extensions, this.creep.pos)
            ) as (StructureExtension | StructureSpawn)[];

            if (targets.length > 0) {
                if (this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    this.creep.transfer(targets[0], RESOURCE_ENERGY);
                } else {
                    if (Memory.rooms[this.creep.memory.home].genBuildings!.links[2].id !== undefined) {
                        const link = Game.getObjectById(
                            Memory.rooms[this.creep.memory.home].genBuildings!.links[2].id!
                        );
                        if (link !== null && link instanceof StructureLink) {
                            if (
                                link.store.getUsedCapacity(RESOURCE_ENERGY) >=
                                targets[0].store.getFreeCapacity(RESOURCE_ENERGY)
                            ) {
                                this.creep.withdraw(link, RESOURCE_ENERGY);
                            }
                        }
                    }
                }
            } else if (
                this.creep.ticksToLive !== undefined &&
                this.creep.ticksToLive < 10 &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            ) {
                const link = Game.getObjectById(Memory.rooms[this.creep.memory.home].genBuildings!.links[2].id!);
                if (link !== null && link instanceof StructureLink) {
                    if (
                        link.store.getFreeCapacity(RESOURCE_ENERGY) >= this.creep.store.getUsedCapacity(RESOURCE_ENERGY)
                    ) {
                        this.creep.transfer(link, RESOURCE_ENERGY);
                    }
                }
            } else if (this.creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                const link = Game.getObjectById(Memory.rooms[this.creep.memory.home].genBuildings!.links[2].id!);
                if (link !== null && link instanceof StructureLink) {
                    if (
                        link.store.getUsedCapacity(RESOURCE_ENERGY) >= this.creep.store.getFreeCapacity(RESOURCE_ENERGY)
                    ) {
                        this.creep.withdraw(link, RESOURCE_ENERGY);
                    }
                }
            }
        }
    }
}

function GetEnergyBuildings(buildings: BuildingData[], pos: RoomPosition): Structure[] {
    const structures: Structure[] = [];
    for (const building of buildings) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (
                (object instanceof StructureExtension || object instanceof StructureSpawn) &&
                pos.isNearTo(object.pos) &&
                object.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                structures.push(object);
            }
        }
    }
    return structures;
}
