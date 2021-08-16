import { setMovementData } from "creeps/creep";

export interface ProtectorMemory extends CreepMemory {
    room?: string;
}

export function protector(creep: Creep) {
    const memory = creep.memory as ProtectorMemory;
    const home = Game.rooms[creep.memory.home];

    if (memory.room === undefined) {
        memory.room = home.name;
    }

    const hostiles: Creep[] = creep.room.find(FIND_HOSTILE_CREEPS);
    const cores: StructureInvaderCore[] = creep.room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_INVADER_CORE
    }) as StructureInvaderCore[];

    if (hostiles.length === 0 && cores.length === 0 && creep.room.name === memory.room) {
        let foundRoom: boolean = false;
        if (Memory.rooms[home.name].remotes !== undefined) {
            for (const remote of Memory.rooms[home.name].remotes) {
                if (
                    (Memory.rooms[remote] !== undefined && Object.keys(Memory.rooms[remote].hostiles).length > 0) ||
                    (Game.rooms[remote] !== undefined && Game.rooms[remote].find(FIND_HOSTILE_STRUCTURES).length > 0)
                ) {
                    memory.room = remote;
                    foundRoom = true;
                    break;
                }
            }
        }
        if (!foundRoom) {
            memory.room = home.name;
        }
    } else if (hostiles.length === 0 && cores.length === 0 && creep.room.name !== memory.room) {
        setMovementData(creep, {
            pos: new RoomPosition(25, 25, memory.room),
            range: 23
        });
    }

    if (hostiles.length > 0) {
        const hostile: Creep | null = creep.pos.findClosestByRange(hostiles);
        if (hostile != null) {
            creep.rangedAttack(hostile);
            setMovementData(creep, {
                pos: hostile.pos,
                range: 1
            });
            if (creep.pos.isNearTo(hostile.pos)) {
                creep.attack(hostile);
            } else {
                if (creep.getActiveBodyparts(HEAL) > 0) {
                    creep.heal(creep);
                }
            }
        }
    } else if (cores.length > 0) {
        const hostile: StructureInvaderCore | null = creep.pos.findClosestByRange(cores);
        if (hostile != null) {
            creep.rangedAttack(hostile);
            setMovementData(creep, {
                pos: hostile.pos,
                range: 1
            });
            if (creep.pos.isNearTo(hostile.pos)) {
                creep.attack(hostile);
            }
        }
    } else if (creep.room.name === memory.home && memory.room === memory.home) {
        if (Memory.rooms[creep.memory.home].genLayout !== undefined) {
            const cpos = new RoomPosition(
                Memory.rooms[creep.memory.home].genLayout!.prefabs[0].x,
                Memory.rooms[creep.memory.home].genLayout!.prefabs[0].y,
                creep.memory.home
            );
            if (creep.pos.getRangeTo(cpos) === 1) {
                setMovementData(creep, {
                    pos: cpos,
                    range: 2,
                    flee: true
                });
            } else {
                setMovementData(creep, {
                    pos: cpos,
                    range: 3
                });
            }
        }
    }
}
