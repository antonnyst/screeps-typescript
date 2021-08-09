import * as roles from "./roles";

type CreepRole = keyof typeof roles;

declare global {
    interface CreepMemory {
        frole?: CreepRole;
    }
}

export function runCreep(creep: Creep): void {
    roles[creep.memory.frole!](creep);
}
