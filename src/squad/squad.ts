import { CreepDescriptor } from "operation/operation";
import { SquadType } from "./runner";

// Contains information about a squad
export interface Squad {
  type: SquadType;
  creeps: CreepDescriptor[];
  spawned?: boolean;
}
