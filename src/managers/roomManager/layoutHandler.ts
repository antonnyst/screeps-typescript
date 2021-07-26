import { unpackPosition, packPosition } from "../../utils/RoomPositionPacker";
import { offsetPositionByDirection } from "../../utils/RoomPositionHelpers";
import { RunEvery } from "../../utils/RunEvery";
import { GenLayoutData } from "layout/layout";
import { AddWork, GetCurrentWorkQueue } from "managers/layoutManager";

declare global {
    interface RoomMemory {
        genLayout?: GenLayoutData;
        genBuildings?: GenBuildingsData;
    }
}
export interface GenBuildingsData {
    roads: BuildingData<STRUCTURE_ROAD>[];
    ramparts: BuildingData<STRUCTURE_RAMPART>[];
    extensions: BuildingData<STRUCTURE_EXTENSION>[];
    towers: BuildingData<STRUCTURE_TOWER>[];
    labs: BuildingData<STRUCTURE_LAB>[];
    links: BuildingData<STRUCTURE_LINK>[];
    spawns: BuildingData<STRUCTURE_SPAWN>[];
    containers: BuildingData<STRUCTURE_CONTAINER>[];
    storage: BuildingData<STRUCTURE_STORAGE>;
    terminal: BuildingData<STRUCTURE_TERMINAL>;
    factory: BuildingData<STRUCTURE_FACTORY>;
    powerspawn: BuildingData<STRUCTURE_POWER_SPAWN>;
    nuker: BuildingData<STRUCTURE_NUKER>;
    observer: BuildingData<STRUCTURE_OBSERVER>;
    extractor: BuildingData<STRUCTURE_EXTRACTOR>;
}
export interface BuildingData<T extends BuildableStructureConstant> {
    pos: number;
    id?: Id<Structure<T> | ConstructionSite<T>>;
    name?: string;
    active: boolean;
    rampart?: {
        id?: Id<Structure<STRUCTURE_RAMPART> | ConstructionSite<STRUCTURE_RAMPART>>;
    };
}

////// LAYOUT HANDLER //////
// The LayoutHandler should ensure a base layout is availible for every controlled room
// It should also generate and update building data and place construction sites based upon it

export function LayoutHandler(room: Room): void {
    if (room.memory.roomLevel === 2 && room.memory.basicRoomData !== undefined) {
        if (Memory.rooms[room.name].genLayout === undefined) {
            // This room has no layout
            // Check if a layout has already been requested
            // If not, request an layout for this room

            let workQueue = GetCurrentWorkQueue();
            let found = false;
            for (const work of workQueue) {
                if (work.room === room.name) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                AddWork({
                    room: room.name,
                    basicRoomData: room.memory.basicRoomData,
                    callback: (layout: GenLayoutData) => {
                        room.memory.genLayout = layout;
                    }
                });
            }
        } else {
            // This room has a layout
            // Proceed with normal behaviour

            // Generate buildings data if it does not exist
            if (Memory.rooms[room.name].genBuildings === undefined) {
                Memory.rooms[room.name].genBuildings = GenerateBuildingsData(room);
            }

            // Regenerate buildings data every 6000 ticks
            RunEvery(
                () => {
                    Memory.rooms[room.name].genBuildings = GenerateBuildingsData(room);
                },
                "layouthandlergeneratebuildinsdata" + room.name,
                6000
            );

            // Update buildings data every 750 ticks
            RunEvery(
                () => {
                    UpdateBuildingsData(room);
                },
                "layouthandlerupdatebuildinsdata" + room.name,
                500
            );

            // Build buildings every 75 ticks
            RunEvery(
                () => {
                    BuildBuildings(room);
                },
                "layouthandlerbuildbuildings" + room.name,
                75
            );
        }
    }
}

function GenerateBuildingsData(room: Room): GenBuildingsData | undefined {
    if (room.memory.genLayout === undefined || room.memory.remoteData === undefined) {
        return undefined;
    }

    let roads: BuildingData<STRUCTURE_ROAD>[] = [];
    let ramparts: BuildingData<STRUCTURE_RAMPART>[] = [];
    let extensions: BuildingData<STRUCTURE_EXTENSION>[] = [];
    let towers: BuildingData<STRUCTURE_TOWER>[] = [];
    let labs: BuildingData<STRUCTURE_LAB>[] = [];
    let links: BuildingData<STRUCTURE_LINK>[] = [];
    let spawns: BuildingData<STRUCTURE_SPAWN>[] = [];
    let containers: BuildingData<STRUCTURE_CONTAINER>[] = [];
    let storage: BuildingData<STRUCTURE_STORAGE> | undefined = undefined;
    let terminal: BuildingData<STRUCTURE_TERMINAL> | undefined = undefined;
    let factory: BuildingData<STRUCTURE_FACTORY> | undefined = undefined;
    let powerspawn: BuildingData<STRUCTURE_POWER_SPAWN> | undefined = undefined;
    let nuker: BuildingData<STRUCTURE_NUKER>;
    let observer: BuildingData<STRUCTURE_OBSERVER>;
    let extractor: BuildingData<STRUCTURE_EXTRACTOR>;

    let spawnIndex = 0;

    for (const prefab of room.memory.genLayout.prefabs) {
        for (const building of prefab.prefab.buildings) {
            const pos = packPosition(
                new RoomPosition(prefab.x + building.dx * prefab.rotx, prefab.y + building.dy * prefab.roty, room.name)
            );

            if (building.type === STRUCTURE_ROAD) {
                roads.push({
                    pos,
                    active: false
                });
            } else if (building.type === STRUCTURE_RAMPART) {
                ramparts.push({
                    pos,
                    active: false
                });
            } else if (building.type === STRUCTURE_EXTENSION) {
                extensions.push({
                    pos,
                    active: false
                });
            } else if (building.type === STRUCTURE_TOWER) {
                towers.push({
                    pos,
                    active: false,
                    rampart: {}
                });
            } else if (building.type === STRUCTURE_LAB) {
                labs.push({
                    pos,
                    active: false,
                    rampart: {}
                });
            } else if (building.type === STRUCTURE_LINK) {
                links.push({
                    pos,
                    active: false,
                    rampart: {}
                });
            } else if (building.type === STRUCTURE_SPAWN) {
                spawns.push({
                    pos,
                    active: false,
                    name: room.name + "-" + spawnIndex,
                    rampart: {}
                });
                spawnIndex++;
            } else if (building.type === STRUCTURE_CONTAINER) {
                containers.push({
                    pos,
                    active: false
                });
            } else if (building.type === STRUCTURE_STORAGE) {
                storage = {
                    pos,
                    active: false,
                    rampart: {}
                };
            } else if (building.type === STRUCTURE_TERMINAL) {
                terminal = {
                    pos,
                    active: false,
                    rampart: {}
                };
            } else if (building.type === STRUCTURE_FACTORY) {
                factory = {
                    pos,
                    active: false,
                    rampart: {}
                };
            } else if (building.type === STRUCTURE_POWER_SPAWN) {
                powerspawn = {
                    pos,
                    active: false,
                    rampart: {}
                };
            }
        }
    }

    //// ROADS ////
    roads = roads.concat(
        room.memory.genLayout.roads.map((r) => {
            return {
                pos: r,
                active: false
            };
        })
    );
    const basePos = new RoomPosition(room.memory.genLayout.prefabs[0].x, room.memory.genLayout.prefabs[0].y, room.name);
    const roadCostMatrix = (roomName: string): boolean | CostMatrix => {
        const room = Game.rooms[roomName];

        if (roomName !== basePos.roomName) {
            if (Memory.rooms[basePos.roomName].remotes === undefined) {
                return false;
            }
            let isRemote = false;
            for (const r of Memory.rooms[basePos.roomName].remotes) {
                if (r === roomName) {
                    isRemote = true;
                    break;
                }
            }

            if (!isRemote) {
                return false;
            }
        }

        const costs = new PathFinder.CostMatrix();

        for (const road of roads) {
            const pos = unpackPosition(road.pos);
            if (pos.roomName === roomName) {
                costs.set(pos.x, pos.y, 1);
            }
        }

        if (room.memory.genLayout !== undefined) {
            for (const prefab of room.memory.genLayout.prefabs) {
                for (const building of prefab.prefab.buildings) {
                    if (building.type !== STRUCTURE_ROAD) {
                        costs.set(prefab.x + building.dx * prefab.rotx, prefab.y + building.dy * prefab.roty, 255);
                    }
                }
            }
            for (const extension of room.memory.genLayout.extensions) {
                const pos = unpackPosition(extension);
                costs.set(pos.x, pos.y, 255);
            }
            for (const tower of room.memory.genLayout.towers) {
                const pos = unpackPosition(tower);
                costs.set(pos.x, pos.y, 255);
            }
            const mpos = offsetPositionByDirection(
                unpackPosition(room.memory.basicRoomData.mineral!.pos),
                room.memory.genLayout.mineral.container
            );
            costs.set(mpos.x, mpos.y, 255);
            const cpos = unpackPosition(room.memory.genLayout.controller);
            costs.set(cpos.x, cpos.y, 255);
        }

        return costs;
    };
    for (const remote in room.memory.remoteData.data) {
        for (const source of room.memory.remoteData.data[remote].sources) {
            const containerPos = offsetPositionByDirection(unpackPosition(source.pos), source.container);

            const search = PathFinder.search(
                basePos,
                {
                    pos: containerPos,
                    range: 1
                },
                {
                    roomCallback: roadCostMatrix
                }
            );

            if (search.incomplete === true) {
                continue;
            }

            for (const pos of search.path) {
                if (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49) {
                    continue;
                }
                roads.push({
                    pos: packPosition(pos),
                    active: false
                });
            }
        }
    }
    roads = removeDuplicates(roads);

    //// RAMPARTS ////
    ramparts = ramparts.concat(
        room.memory.genLayout.ramparts.map((r) => {
            return {
                pos: r,
                active: false
            };
        })
    );
    ramparts = removeDuplicates(ramparts);

    //// EXTENSIONS ////
    extensions = extensions.concat(
        room.memory.genLayout.extensions.map((r) => {
            return {
                pos: r,
                active: false
            };
        })
    );
    extensions = removeDuplicates(extensions);

    //// TOWERS ////
    towers = towers.concat(
        room.memory.genLayout.towers.map((r) => {
            return {
                pos: r,
                active: false,
                rampart: {}
            };
        })
    );
    towers = removeDuplicates(towers);

    //// LABS ////
    labs = removeDuplicates(labs);

    //// LINKS ////
    links.unshift({
        pos: room.memory.genLayout.controller,
        active: false,
        rampart: {}
    });
    for (let i = 0; i < room.memory.genLayout.sources.length; i++) {
        links.push({
            pos: packPosition(
                offsetPositionByDirection(
                    offsetPositionByDirection(
                        unpackPosition(room.memory.basicRoomData.sources[i].pos),
                        room.memory.genLayout.sources[i].container
                    ),
                    room.memory.genLayout.sources[i].link
                )
            ),
            active: false,
            rampart: {}
        });
    }
    links = removeDuplicates(links);

    //// SPAWNS ////
    spawns = removeDuplicates(spawns);

    //// CONTAINERS ////

    containers.push({
        pos: room.memory.genLayout.controller,
        active: false
    });

    for (let i = 0; i < room.memory.genLayout.sources.length; i++) {
        containers.push({
            pos: packPosition(
                offsetPositionByDirection(
                    unpackPosition(room.memory.basicRoomData.sources[i].pos),
                    room.memory.genLayout.sources[i].container
                )
            ),
            active: false
        });
    }

    containers.push({
        pos: packPosition(
            offsetPositionByDirection(
                unpackPosition(room.memory.basicRoomData.mineral!.pos),
                room.memory.genLayout.mineral.container
            )
        ),
        active: false
    });
    containers = removeDuplicates(containers);

    //// NUKER ////
    nuker = {
        pos: room.memory.genLayout.nuker,
        active: false,
        rampart: {}
    };

    //// OBSERVER ////
    observer = {
        pos: room.memory.genLayout.observer,
        active: false,
        rampart: {}
    };

    //// EXTRACTOR ////
    extractor = {
        pos: room.memory.basicRoomData.mineral!.pos,
        active: false
    };

    if (storage === undefined || terminal === undefined || factory === undefined || powerspawn === undefined) {
        return undefined;
    }

    return {
        roads,
        ramparts,
        extensions,
        towers,
        labs,
        links,
        spawns,
        containers,
        storage,
        terminal,
        factory,
        powerspawn,
        nuker,
        observer,
        extractor
    };
}

function UpdateBuildingsData(room: Room): void {
    if (room.memory.genBuildings === undefined || room.controller === undefined) {
        return;
    }

    const roadsActive: boolean =
        room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length >= 5;

    if (roadsActive) {
        for (const road of room.memory.genBuildings.roads) {
            road.active = true;
        }
    }

    const rampartsActive: boolean = room.controller.level > 3;
    if (rampartsActive) {
        for (const rampart of room.memory.genBuildings.ramparts) {
            rampart.active = true;
        }
    }

    for (let i = 0; i < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level]; i++) {
        room.memory.genBuildings.extensions[i].active = true;
    }

    for (let i = 0; i < CONTROLLER_STRUCTURES[STRUCTURE_TOWER][room.controller.level]; i++) {
        room.memory.genBuildings.towers[i].active = true;
    }

    for (let i = 0; i < CONTROLLER_STRUCTURES[STRUCTURE_LAB][room.controller.level]; i++) {
        room.memory.genBuildings.labs[i].active = true;
    }

    for (let i = 0; i < CONTROLLER_STRUCTURES[STRUCTURE_LINK][room.controller.level]; i++) {
        room.memory.genBuildings.links[i].active = true;
    }

    for (let i = 0; i < CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][room.controller.level]; i++) {
        room.memory.genBuildings.spawns[i].active = true;
    }

    for (let i = 0; i < room.memory.genBuildings.containers.length - 1; i++) {
        room.memory.genBuildings.containers[i].active = true;
    }
    if (room.controller.level >= 5) {
        room.memory.genBuildings.containers[2].active = false;
    }
    if (room.controller.level >= 6) {
        room.memory.genBuildings.containers[room.memory.genBuildings.containers.length - 1].active = true;
    }

    if (CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][room.controller.level] > 0) {
        room.memory.genBuildings.storage.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL][room.controller.level] > 0) {
        room.memory.genBuildings.terminal.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_FACTORY][room.controller.level] > 0) {
        room.memory.genBuildings.factory.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_POWER_SPAWN][room.controller.level] > 0) {
        room.memory.genBuildings.powerspawn.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_NUKER][room.controller.level] > 0) {
        room.memory.genBuildings.nuker.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_OBSERVER][room.controller.level] > 0) {
        room.memory.genBuildings.observer.active = true;
    }
    if (CONTROLLER_STRUCTURES[STRUCTURE_EXTRACTOR][room.controller.level] > 0) {
        room.memory.genBuildings.extractor.active = true;
    }
}

const MAX_SITES_PER_COLONY = 3;

function BuildBuildings(room: Room): void {
    if (room.memory.genBuildings === undefined) {
        return;
    }

    //let massLeft = (Object.keys(room.memory.repair).length > 0 ? 0 : 2) - ;

    let buildingSpotsLeft = MAX_SITES_PER_COLONY - room.find(FIND_CONSTRUCTION_SITES).length;

    for (const extension of room.memory.genBuildings.extensions) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(extension, STRUCTURE_EXTENSION);
        if (res) {
            buildingSpotsLeft--;
        }
    }
    for (const tower of room.memory.genBuildings.towers) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(tower, STRUCTURE_TOWER);
        if (res) {
            buildingSpotsLeft--;
        }
    }
    for (const lab of room.memory.genBuildings.labs) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(lab, STRUCTURE_LAB);
        if (res) {
            buildingSpotsLeft--;
        }
    }
    for (const link of room.memory.genBuildings.links) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(link, STRUCTURE_LINK);
        if (res) {
            buildingSpotsLeft--;
        }
    }
    for (const spawn of room.memory.genBuildings.spawns) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(spawn, STRUCTURE_SPAWN);
        if (res) {
            buildingSpotsLeft--;
        }
    }
    for (const container of room.memory.genBuildings.containers) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(container, STRUCTURE_CONTAINER);
        if (res) {
            buildingSpotsLeft--;
        }
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    let res = BuildBuilding(room.memory.genBuildings.storage, STRUCTURE_STORAGE);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.terminal, STRUCTURE_TERMINAL);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.factory, STRUCTURE_FACTORY);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.powerspawn, STRUCTURE_POWER_SPAWN);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.nuker, STRUCTURE_NUKER);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.observer, STRUCTURE_OBSERVER);
    if (res) {
        buildingSpotsLeft--;
    }

    if (buildingSpotsLeft <= 0) {
        return;
    }
    res = BuildBuilding(room.memory.genBuildings.extractor, STRUCTURE_EXTRACTOR);
    if (res) {
        buildingSpotsLeft--;
    }

    if (room.memory.repair === undefined || Object.keys(room.memory.repair).length > 0) {
        return;
    }

    for (const road of room.memory.genBuildings.roads) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(road, STRUCTURE_ROAD);
        if (res) {
            buildingSpotsLeft--;
        }
    }

    for (const rampart of room.memory.genBuildings.ramparts) {
        if (buildingSpotsLeft <= 0) {
            return;
        }
        const res = BuildBuilding(rampart, STRUCTURE_RAMPART);
        if (res) {
            buildingSpotsLeft--;
        }
    }
}

function BuildBuilding<T extends BuildableStructureConstant>(
    building: BuildingData<T>,
    type: BuildableStructureConstant
): boolean {
    if (building.active === false) {
        if (building.id !== undefined && Game.rooms[unpackPosition(building.pos).roomName] !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object !== null) {
                if (object instanceof Structure) {
                    object.destroy();
                } else {
                    object.remove();
                }
            }
            building.id = undefined;
        }
        return false;
    }
    if (building.rampart !== undefined) {
        if (building.rampart.id !== undefined) {
            if (
                Game.rooms[unpackPosition(building.pos).roomName] !== undefined &&
                Game.getObjectById(building.rampart.id) === null
            ) {
                building.rampart.id = undefined;
            }
        }
        if (building.rampart.id === undefined) {
            const pos: RoomPosition = unpackPosition(building.pos);
            const room: Room = Game.rooms[pos.roomName];
            if (room === undefined) {
                return false;
            }
            const structures: Structure<StructureConstant>[] = pos.lookFor(LOOK_STRUCTURES);
            for (const structure of structures) {
                if (structure.structureType === STRUCTURE_RAMPART) {
                    building.rampart.id = structure.id as Id<Structure<STRUCTURE_RAMPART>>;
                    return false;
                }
            }
            const constructionSites: ConstructionSite<BuildableStructureConstant>[] = pos.lookFor(
                LOOK_CONSTRUCTION_SITES
            );
            for (const site of constructionSites) {
                if (site.structureType === STRUCTURE_RAMPART) {
                    building.rampart.id = site.id as Id<ConstructionSite<STRUCTURE_RAMPART>>;
                    return false;
                }
            }
            return room.createConstructionSite(pos, STRUCTURE_RAMPART) === 0;
        }
    }
    if (building.id !== undefined) {
        if (Game.rooms[unpackPosition(building.pos).roomName] === undefined) {
            return false;
        }

        if (Game.getObjectById(building.id) !== null) {
            // we already have a structure/constructionSite for this building
            return false;
        }
        building.id = undefined;
    }
    const pos: RoomPosition = unpackPosition(building.pos);
    const room: Room = Game.rooms[pos.roomName];
    if (room === undefined) {
        return false;
    }
    const structures: Structure<StructureConstant>[] = pos.lookFor(LOOK_STRUCTURES);
    for (const structure of structures) {
        if (structure.structureType === type) {
            building.id = structure.id as Id<Structure<T>>;
            return false;
        }
    }
    const constructionSites: ConstructionSite<BuildableStructureConstant>[] = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    for (const site of constructionSites) {
        if (site.structureType === type) {
            building.id = site.id as Id<ConstructionSite<T>>;
            return false;
        }
    }

    if (type === STRUCTURE_SPAWN && building.name !== undefined) {
        let name = building.name || "";
        name = name.replace("{ROOM_NAME}", room.name);

        let i = 1;
        const done: boolean = false;
        while (!done) {
            const potentialName = name.replace("{INDEX}", i.toString());

            const res = room.createConstructionSite(pos.x, pos.y, type, potentialName);

            if (res === OK) {
                return true;
            }
            i++;
            if (i > 5) {
                break;
            }
        }
        return false;
    } else {
        return room.createConstructionSite(pos, type) === 0;
    }
}

function removeDuplicates<T extends BuildableStructureConstant>(array: BuildingData<T>[]): BuildingData<T>[] {
    let seen: { [key in string]: boolean } = {};
    return array.filter((value) => {
        return seen.hasOwnProperty(value.pos) ? false : (seen[value.pos] = true);
    });
}
