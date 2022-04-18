import * as SquadLogic from "./squads/";
import { Squad } from "./squad";

export type SquadType = keyof typeof SquadLogic;

export function runSquad(squad: Squad): void {
  // eslint-disable-next-line import/namespace
  SquadLogic[squad.type](squad);
}
