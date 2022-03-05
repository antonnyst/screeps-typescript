import { OperationType } from "./runner";

// Contains information about an operation
export interface Operation {
  type: OperationType;
  expire?: number;
  target: string;
  source: string;
  squads: Squad[];
  creeps: CreepDescriptor[];
  children: Operation[];
}

// Contains information about a squad
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Squad {}

// Creep descriptor
export interface CreepDescriptor {
  current?: string;
  body: string;
  memory: CreepMemory;
}
