import { autoLabsInLabsLocation, autoLabsRotationGuide } from "config/base/auto";
import { AutoLayoutData } from "dataInterfaces/layoutData";
import { LabsData, LabData } from "../../dataInterfaces/labsData";
import { unpackPosition } from "../../utils/RoomPositionPacker";

export function LabHandler(room: Room): void {
    runLabData(room);
}

function runLabData(room: Room): void {
    if (room.controller === undefined || !room.controller.my) {
        return;
    }
    if (room.memory.layout && room.memory.layout.baseType !== "bunker") {
        return;
    }
    if (room.controller.level < 6) {
        room.memory.labs = undefined;
    } else {
        if (room.memory.labs === undefined) {
            room.memory.labs = GenerateLabsData(room);
        }
        UpdateLabData(room);

        RunLabs(room);

        if (room.memory.labs.status === "prepare-react") {
            let ready: boolean = true;

            for (const lab of room.memory.labs.labs) {
                const labObj = Game.getObjectById(lab.id) as StructureLab;
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
function RunLabs(room: Room): void {
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

function GenerateLabsData(room: Room): LabsData {
    const labs: LabData[] = room
        .find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_LAB })
        .map((l) => {
            return {
                id: l.id,
                targetResource: null
            };
        });

    const inLabs: number[] = [];
    const outLabs: number[] = [];

    const cpos = unpackPosition(room.memory.layout.baseCenter);
    let ipos: RoomPosition[] = [
        new RoomPosition(cpos.x, cpos.y + 4, cpos.roomName),
        new RoomPosition(cpos.x, cpos.y + 5, cpos.roomName)
    ];

    if (room.memory.layout.baseType === "auto") {
        ipos = [
            new RoomPosition(
                autoLabsInLabsLocation[0].x *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].mx,
                autoLabsInLabsLocation[0].y *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].my,
                cpos.roomName
            ),
            new RoomPosition(
                autoLabsInLabsLocation[1].x *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].mx,
                autoLabsInLabsLocation[1].y *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].my,
                cpos.roomName
            )
        ];
    }
    for (const la in labs) {
        const l = Game.getObjectById(labs[la].id) as StructureLab;
        if (l != null) {
            if (l.pos.isEqualTo(ipos[0]) || l.pos.isEqualTo(ipos[1])) {
                inLabs.push(parseInt(la, 10));
            } else {
                outLabs.push(parseInt(la, 10));
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
function UpdateLabData(room: Room) {
    if (room.memory.labs === undefined || room.memory.layout === undefined) {
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

    const cpos = unpackPosition(room.memory.layout.baseCenter);
    let ipos: RoomPosition[] = [
        new RoomPosition(cpos.x, cpos.y + 4, cpos.roomName),
        new RoomPosition(cpos.x, cpos.y + 5, cpos.roomName)
    ];

    if (room.memory.layout.baseType === "auto") {
        ipos = [
            new RoomPosition(
                autoLabsInLabsLocation[0].x *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].mx,
                autoLabsInLabsLocation[0].y *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].my,
                cpos.roomName
            ),
            new RoomPosition(
                autoLabsInLabsLocation[1].x *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].mx,
                autoLabsInLabsLocation[1].y *
                    autoLabsRotationGuide[(room.memory.layout as AutoLayoutData).labDirection].my,
                cpos.roomName
            )
        ];
    }

    for (const la in labs) {
        const l = Game.getObjectById(labs[la].id) as StructureLab;
        if (l != null) {
            if (l.pos.isEqualTo(ipos[0]) || l.pos.isEqualTo(ipos[1])) {
                inLabs.push(parseInt(la, 10));
            } else {
                outLabs.push(parseInt(la, 10));
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
