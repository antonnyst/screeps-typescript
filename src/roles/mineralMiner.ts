import { CreepRole } from "./creepRole";
import { offsetPositionByDirection } from "../utils/RoomPositionHelpers";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class MineralMinerRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        const minerPos = offsetPositionByDirection(
            unpackPosition(Memory.rooms[this.creep.memory.home].layout.mineral.pos),
            Memory.rooms[this.creep.memory.home].layout.mineral.container
        );
        const mineral = Game.getObjectById(Memory.rooms[this.creep.memory.home].layout.mineral.id) as Mineral;

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

        if (container !== undefined) {
            this.creep.memory.roleData.target = container.id;
        }

        this.setMovementData(minerPos, 0, false, true);
        if (
            this.creep.pos.isEqualTo(minerPos) &&
            container !== undefined &&
            container.store.getFreeCapacity() >= this.creep.getActiveBodyparts(WORK)
        ) {
            this.creep.harvest(mineral);
        }
    }
}
