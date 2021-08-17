import * as roles from "./roles";
import { logic } from "./basic";

export type CreepRole = keyof typeof roles;

declare global {
    interface CreepMemory {
        role: CreepRole;
    }
}

export function runCreep(creep: Creep): void {
    logic(roles[creep.memory.role], creep);
}
