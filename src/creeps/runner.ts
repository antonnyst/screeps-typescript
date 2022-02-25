import * as roles from "./roles";
import { logic } from "./logic";

export type CreepRole = keyof typeof roles;

declare global {
  interface CreepMemory {
    role: CreepRole;
  }
}

export function runCreep(creep: Creep): void {
  // eslint-disable-next-line import/namespace
  logic(roles[creep.memory.role], creep);
}
