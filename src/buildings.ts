import { BuildingData } from "managers/roomManager/layoutHandler";

export function Storage(room: Room): StructureStorage | null {
    return Building(room.memory.genBuildings?.storage) as StructureStorage | null;
}

export function Terminal(room: Room): StructureTerminal | null {
    return Building(room.memory.genBuildings?.terminal) as StructureTerminal | null;
}

export function Factory(room: Room): StructureFactory | null {
    return Building(room.memory.genBuildings?.factory) as StructureFactory | null;
}

export function PowerSpawn(room: Room): StructurePowerSpawn | null {
    return Building(room.memory.genBuildings?.powerspawn) as StructurePowerSpawn | null;
}

export function Nuker(room: Room): StructureNuker | null {
    return Building(room.memory.genBuildings?.nuker) as StructureNuker | null;
}

export function Observer(room: Room): StructureObserver | null {
    return Building(room.memory.genBuildings?.observer) as StructureObserver | null;
}

export function Building(data: BuildingData | undefined): Structure | null {
    if (data === undefined || data.id === undefined) {
        return null;
    }
    const object = Game.getObjectById(data.id);
    if (object !== null && !(object instanceof ConstructionSite)) {
        return object;
    }
    return null;
}

export function Spawns(room: Room): StructureSpawn[] | null {
    return Buildings(room.memory.genBuildings?.spawns) as StructureSpawn[] | null;
}

export function Towers(room: Room): StructureTower[] | null {
    return Buildings(room.memory.genBuildings?.towers) as StructureTower[] | null;
}

export function Buildings(data: BuildingData[] | undefined): Structure[] | null {
    if (data === undefined) {
        return null;
    }
    const array: Structure[] = [];
    for (const building of data) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object !== null && !(object instanceof ConstructionSite)) {
                array.push(object);
            }
        }
    }
    return array;
}
