import * as C from "../../config/constants";

declare global {
    interface OwnedRoomMemory {
        resources?: ResourcesData;
    }
}

interface ResourcesData {
    total: { [resourceType in ResourceConstant]: number };
    delta: { [resourceType in ResourceConstant]: number };
}

export function ResourceHandler(room: OwnedRoom): void {
    ResourceData(room);
}

function ResourceData(room: OwnedRoom): void {
    if (room.controller === undefined || !room.controller.my) {
        room.memory.resources = undefined;
        return;
    }
    const total: { [resourceType in ResourceConstant]: number } = {} as { [resourceType in ResourceConstant]: number };
    const delta: { [resourceType in ResourceConstant]: number } = {} as { [resourceType in ResourceConstant]: number };

    let unclaimReady = true;
    for (const resource of RESOURCES_ALL) {
        const storage = room.storage === undefined ? 0 : room.storage.store.getUsedCapacity(resource);
        const terminal = room.terminal === undefined ? 0 : room.terminal.store.getUsedCapacity(resource);

        const f: StructureFactory = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_FACTORY
        })[0] as StructureFactory;
        const factory = f === undefined ? 0 : f.store.getUsedCapacity(resource);

        const l: StructureLab[] = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_LAB
        }) as StructureLab[];
        const labs: number =
            resource === RESOURCE_ENERGY
                ? 0
                : _.sum(l, (lab: StructureLab) => {
                      const amt: number | null = lab.store.getUsedCapacity(resource);

                      if (amt === null) {
                          return 0;
                      } else {
                          return amt;
                      }
                  });

        const c: Creep[] = room.find(FIND_MY_CREEPS);
        const creeps = _.sum(c, (creep: Creep) =>
            creep.store.getUsedCapacity(resource) === null ? 0 : creep.store.getUsedCapacity(resource)
        );

        const containers = _.sum(
            room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }),
            (container) => (container as StructureContainer).store.getUsedCapacity(resource)
        );

        total[resource] = storage + terminal + factory + labs + creeps + containers;

        let importLimit: number | null = null;
        let exportLimit: number | null = null;

        if (room.memory.unclaim !== undefined) {
            importLimit = -1;
            exportLimit = 0;
        } else if (resource === RESOURCE_ENERGY) {
            importLimit = C.ROOM_ENERGY_IMPORT_LIMIT;
            exportLimit = C.ROOM_ENERGY_EXPORT_LIMIT;
        } else if (C.TERMINAL_MINERALS.includes(resource)) {
            importLimit = C.ROOM_MINERAL_IMPORT_LIMIT;
            exportLimit = C.ROOM_MINERAL_EXPORT_LIMIT;
        } else if (C.TERMINAL_RAW_COMMODITIES.includes(resource)) {
            importLimit = C.ROOM_MINERAL_IMPORT_LIMIT;
            exportLimit = C.ROOM_MINERAL_EXPORT_LIMIT;
        }

        let d: number = 0;

        if (importLimit === null || exportLimit === null) {
            d = total[resource];
        } else {
            if (total[resource] < importLimit) {
                d = -(importLimit - total[resource]);
            } else if (total[resource] > exportLimit) {
                d = total[resource] - exportLimit;
            }
        }

        if (resource === RESOURCE_ENERGY) {
            if (d > 1000) {
                unclaimReady = false;
            }
        } else {
            if (d !== 0) {
                unclaimReady = false;
            }
        }

        delta[resource] = d;
    }

    if (room.memory.unclaim === 1 && unclaimReady === true) {
        room.memory.unclaim = 2;
    }

    room.memory.resources = {
        total: total as { [resourceType in ResourceConstant]: number },
        delta: delta as { [resourceType in ResourceConstant]: number }
    };
}
