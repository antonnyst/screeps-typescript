import { RAMPART_PERCENTAGE_MAX } from "config/constants";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";

declare global {
    interface RoomMemory {
        placedCS: PlacedConstructionData[];
        plannedCS: PlannedConstructionData[];
        buildEnergy: number;
    }
}

interface PlannedConstructionData {
    pos: number;
    type: BuildableStructureConstant;
    name?: string;
}
interface PlacedConstructionData {
    pos: number;
    type: BuildableStructureConstant;
    id: Id<ConstructionSite>;
}

const PLACED_SITES_AMOUNT = 3;

////// CONSTRUCTION HANDLER //////
// The ConstructionHandler should populate the placed construction site data and place new data based on the plannedCS data

export function ConstructionHandler(room: Room): void {
    if (room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        if (room.memory.plannedCS === undefined) {
            room.memory.plannedCS = [];
        }
        if (room.memory.placedCS === undefined) {
            room.memory.placedCS = [];
        }
        let remoteSites: ConstructionSite[] = [];

        for (const r in room.memory.remotes) {
            const remote: string = room.memory.remotes[r];
            if (Game.rooms[remote] !== undefined) {
                remoteSites = remoteSites.concat(Game.rooms[remote].find(FIND_MY_CONSTRUCTION_SITES));
            }
        }

        const sites: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES).concat(remoteSites);
        const siteMap: { [key in string]: number } = {};

        let energyNeed = 0;
        for (const site of sites) {
            energyNeed += Math.ceil((site.progressTotal - site.progress) / BUILD_POWER);
            if (site.structureType === STRUCTURE_RAMPART) {
                energyNeed += Math.ceil(
                    (RAMPART_HITS_MAX[room.controller.level] * RAMPART_PERCENTAGE_MAX) / REPAIR_POWER
                );
            }
            siteMap[site.id] = 1;
        }
        room.memory.buildEnergy = Math.ceil(energyNeed);

        for (let i = room.memory.placedCS.length - 1; i >= 0; i--) {
            if (siteMap[room.memory.placedCS[i].id] === undefined) {
                room.memory.placedCS.splice(i, 1);
            } else {
                siteMap[room.memory.placedCS[i].id] = 2;
            }
        }

        for (const site of sites) {
            if (siteMap[site.id] === 1) {
                room.memory.placedCS.push({
                    id: site.id,
                    type: site.structureType,
                    pos: packPosition(site.pos)
                });
            }
        }

        if (room.memory.placedCS.length < PLACED_SITES_AMOUNT && room.memory.plannedCS.length > 0) {
            let plcs: PlannedConstructionData | undefined = room.memory.plannedCS.shift();
            if (plcs !== undefined) {
                let res = -1;
                if (plcs.type === STRUCTURE_SPAWN && plcs.name !== undefined) {
                    res = unpackPosition(plcs.pos).createConstructionSite(plcs.type, plcs.name);
                } else {
                    res = unpackPosition(plcs.pos).createConstructionSite(plcs.type);
                }
                if (res !== 0 && res !== -7) {
                    room.memory.plannedCS.push(plcs);
                }
            }
        }
    }
}
