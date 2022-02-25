import { setMovementData } from "../creep";

// TODO: Garbage recycling

export function garbage(creep: Creep): void {
  setMovementData(creep, {
    pos: creep.pos,
    range: 5
  });
}
