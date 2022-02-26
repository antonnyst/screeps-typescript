import { BOOST_COMPONENTS } from "config/constants";
import { RunEvery } from "utils/RunEvery";
import { Terminal } from "buildings";

declare global {
  interface OwnedRoomMemory {
    labs?: LabsData;
  }
}
export type LabStatus = "idle" | "prepare-react" | "react" | "boost";

export interface LabsData {
  status: LabStatus;
  target: ResourceConstant | null;
  labs: LabData[];
  inLabs: number[];
  outLabs: number[];
}
export interface LabData {
  id: Id<StructureLab>;
  targetResource: ResourceConstant | null;
}

// //// LAB HANDLER //////
// The LabHandler should run the lab reactions

export function LabHandler(room: OwnedRoom): void {
  runLabData(room);
}

function runLabData(room: OwnedRoom): void {
  if (room.controller.level < 6) {
    room.memory.labs = undefined;
  } else {
    if (room.memory.labs === undefined) {
      room.memory.labs = GenerateLabsData(room);
    } else {
      RunEvery(UpdateLabData, room.name + "updatelabsdata", 100, room);

      RunLabs(room);

      if (room.memory.labs.status === "prepare-react") {
        let ready = true;

        for (const lab of room.memory.labs.labs) {
          const labObj = Game.getObjectById(lab.id);
          if (lab.targetResource === null && labObj !== null && labObj.mineralType == null) {
            // lab is ready
            continue;
          }

          if (
            lab.targetResource !== null &&
            labObj != null &&
            labObj.mineralType === lab.targetResource &&
            labObj.store.getFreeCapacity(labObj.mineralType) === 0
          ) {
            // lab is ready
            continue;
          }

          ready = false;
          break;
        }

        if (ready) {
          room.memory.labs.status = "react";
          room.memory.labs.target = null;
        }
      }
      if (room.memory.labs.status === "idle" && room.memory.labs.target !== null) {
        const components = BOOST_COMPONENTS[room.memory.labs.target];
        const terminal = Terminal(room);
        if (components !== undefined && terminal !== null) {
          let hasResources = true;
          for (const component of components) {
            if (terminal.store.getUsedCapacity(component) <= LAB_MINERAL_CAPACITY * 2) {
              hasResources = false;
            }
          }
          if (hasResources) {
            room.memory.labs.labs[room.memory.labs.inLabs[0]].targetResource = components[0];
            room.memory.labs.labs[room.memory.labs.inLabs[1]].targetResource = components[1];
            for (const labIndex of room.memory.labs.outLabs) {
              room.memory.labs.labs[labIndex].targetResource = null;
            }
            room.memory.labs.status = "prepare-react";
          }
        }
      }
    }
  }
}
function RunLabs(room: OwnedRoom): void {
  if (room.memory.labs && room.memory.labs.status === "react") {
    const inLabs: StructureLab[] = [];
    const outLabs: StructureLab[] = [];

    for (const i of room.memory.labs.inLabs) {
      const r: StructureLab | null = Game.getObjectById(room.memory.labs.labs[i].id);
      if (r !== null) {
        inLabs.push(r);
      }
    }
    for (const i of room.memory.labs.outLabs) {
      const r: StructureLab | null = Game.getObjectById(room.memory.labs.labs[i].id);
      if (r !== null) {
        outLabs.push(r);
      }
    }

    if (inLabs.length !== 2) {
      return;
    }

    for (const lab of outLabs) {
      lab.runReaction(inLabs[0], inLabs[1]);
    }
    if (inLabs[0].mineralType == null || inLabs[1].mineralType == null) {
      room.memory.labs.status = "idle";
      for (const lab of room.memory.labs.labs) {
        lab.targetResource = null;
      }
    }
  }
}

function GenerateLabsData(room: OwnedRoom): LabsData | undefined {
  if (room.memory.genLayout === undefined) {
    return undefined;
  }

  const labs: LabData[] = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).map(l => {
    return {
      id: l.id as Id<StructureLab>,
      targetResource: null
    };
  });

  const inLabs: number[] = [];
  const outLabs: number[] = [];

  const ipos: RoomPosition[] = [
    new RoomPosition(
      room.memory.genLayout.prefabs[1].x + 1 * room.memory.genLayout.prefabs[1].rotx,
      room.memory.genLayout.prefabs[1].y + -2 * room.memory.genLayout.prefabs[1].roty,
      room.name
    ),
    new RoomPosition(
      room.memory.genLayout.prefabs[1].x + 2 * room.memory.genLayout.prefabs[1].rotx,
      room.memory.genLayout.prefabs[1].y + -1 * room.memory.genLayout.prefabs[1].roty,
      room.name
    )
  ];

  for (let i = 0; i < labs.length; i++) {
    const labObject = Game.getObjectById(labs[i].id);
    if (labObject !== null) {
      if (labObject.pos.isEqualTo(ipos[0]) || labObject.pos.isEqualTo(ipos[1])) {
        inLabs.push(i);
      } else {
        outLabs.push(i);
      }
    }
  }

  return {
    status: "idle",
    target: null,
    labs,
    inLabs,
    outLabs
  };
}
function UpdateLabData(room: OwnedRoom) {
  if (room.memory.labs === undefined || room.memory.genLayout === undefined) {
    return;
  }
  const oldLabs = room.memory.labs.labs;
  const newLabs: LabData[] = _.compact(
    room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }).map(l => {
      for (const la of oldLabs) {
        if (la.id === l.id) {
          return undefined;
        }
      }
      return {
        id: l.id,
        targetResource: null
      };
    })
  ) as LabData[];

  const labs = oldLabs.concat(newLabs);

  const inLabs: number[] = [];
  const outLabs: number[] = [];

  const ipos: RoomPosition[] = [
    new RoomPosition(
      room.memory.genLayout.prefabs[1].x + 1 * room.memory.genLayout.prefabs[1].rotx,
      room.memory.genLayout.prefabs[1].y + -2 * room.memory.genLayout.prefabs[1].roty,
      room.name
    ),
    new RoomPosition(
      room.memory.genLayout.prefabs[1].x + 2 * room.memory.genLayout.prefabs[1].rotx,
      room.memory.genLayout.prefabs[1].y + -1 * room.memory.genLayout.prefabs[1].roty,
      room.name
    )
  ];

  for (let i = 0; i < labs.length; i++) {
    const labObject = Game.getObjectById(labs[i].id);
    if (labObject !== null) {
      if (labObject.pos.isEqualTo(ipos[0]) || labObject.pos.isEqualTo(ipos[1])) {
        inLabs.push(i);
      } else {
        outLabs.push(i);
      }
    }
  }

  room.memory.labs = {
    status: room.memory.labs.status,
    target: room.memory.labs.target || null,
    labs,
    inLabs,
    outLabs
  };
}
