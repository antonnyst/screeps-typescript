declare global {
    interface OwnedRoomMemory {
        labs?: LabsData;
    }
}

export interface LabsData {
    status: string;
    labs: LabData[];
    inLabs: number[];
    outLabs: number[];
}
export interface LabData {
    id: Id<StructureLab>;
    targetResource: ResourceConstant | null;
}

////// LAB HANDLER //////
// The LabHandler should run the lab reactions

export function LabHandler(room: OwnedRoom): void {
    runLabData(room);
}

function runLabData(room: OwnedRoom): void {
    if (room.controller === undefined || !room.controller.my) {
        return;
    }
    if (room.controller.level < 6) {
        room.memory.labs = undefined;
    } else {
        if (room.memory.labs === undefined) {
            room.memory.labs = GenerateLabsData(room);
        } else {
            UpdateLabData(room);

            RunLabs(room);

            if (room.memory.labs.status === "prepare-react") {
                let ready: boolean = true;

                for (const lab of room.memory.labs.labs) {
                    const labObj = Game.getObjectById(lab.id);
                    if (lab.targetResource === null && labObj != null && labObj.mineralType == null) {
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
    }
}

function GenerateLabsData(room: OwnedRoom): LabsData | undefined {
    if (room.memory.genLayout === undefined) {
        return undefined;
    }

    const labs: LabData[] = room
        .find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_LAB })
        .map((l) => {
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
        room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_LAB }).map((l) => {
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
        labs,
        inLabs,
        outLabs
    };
}
