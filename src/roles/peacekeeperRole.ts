import { CreepRole } from "./creepRole";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class PeacekeeperRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {
                target: this.creep.memory.home
            };
        }

        const hostiles: Creep[] = this.creep.room.find(FIND_HOSTILE_CREEPS);
        const cores: StructureInvaderCore[] = this.creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_INVADER_CORE
        }) as StructureInvaderCore[];

        if (hostiles.length === 0 && cores.length === 0 && this.creep.room.name === this.creep.memory.roleData.target) {
            // we are done here
            // retarget

            let foundRoom: boolean = false;

            for (const remote of Memory.rooms[this.creep.memory.home].remotes) {
                if (
                    Object.keys(Memory.rooms[remote].hostiles).length > 0 ||
                    (Game.rooms[remote] !== undefined && Game.rooms[remote].find(FIND_HOSTILE_STRUCTURES).length > 0)
                ) {
                    this.creep.memory.roleData.target = remote;
                    foundRoom = true;

                    break;
                }
            }

            if (!foundRoom) {
                this.creep.memory.roleData.target = this.creep.memory.home;
            }
        } else if (
            hostiles.length === 0 &&
            this.creep.memory.roleData.target !== undefined &&
            this.creep.memory.roleData.target !== this.creep.room.name
        ) {
            this.smartMove(new RoomPosition(25, 25, this.creep.memory.roleData.target));
        }

        if (hostiles.length > 0) {
            // engage combat!

            const hostile: Creep | null = this.creep.pos.findClosestByRange(hostiles);

            if (hostile != null) {
                this.creep.rangedAttack(hostile);
                if (this.creep.attack(hostile) === ERR_NOT_IN_RANGE) {
                    this.smartMove(hostile.pos);
                }
            }
        } else if (cores.length > 0) {
            const hostile: StructureInvaderCore | null = this.creep.pos.findClosestByRange(cores);

            if (hostile != null) {
                this.creep.rangedAttack(hostile);
                if (this.creep.attack(hostile) === ERR_NOT_IN_RANGE) {
                    this.smartMove(hostile.pos);
                }
            }
        } else if (
            this.creep.room.name === this.creep.memory.home &&
            this.creep.memory.roleData.target === this.creep.memory.home
        ) {
            const cpos = unpackPosition(this.creep.room.memory.layout.baseCenter);

            this.smartMove(new RoomPosition(cpos.x, cpos.y, this.creep.memory.home), 6);
        }
    }
}
