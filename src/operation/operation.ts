import { OperationType } from "./runner";
import { Squad } from "squad/squad";

// Contains information about an operation
export interface Operation {
  type: OperationType;
  active: boolean;
  target: string[];
  source: string;
  squads: Squad[];
  creeps: CreepDescriptor[];
  children: Operation[];
}

// Creep descriptor
export interface CreepDescriptor {
  current?: string;
  body: string;
  memory: CreepMemory;
}
