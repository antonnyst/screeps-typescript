import { unpackPosition, packPosition } from "../../utils/RoomPositionPacker";
import { offsetPositionByDirection } from "../../utils/RoomPositionHelpers";
import { RunEvery, RunNow } from "../../utils/RunEvery";
import { GenLayoutData } from "layout/layout";
import { AddWork, GetCurrentWorkQueue } from "managers/layoutManager";

declare global {
    interface RoomMemory {
        genLayout?: GenLayoutData;
        genBuildings?: GenBuildingsData;
    }
}

export interface GenBuildingsData {
    roads: BuildingData[];
    ramparts: BuildingData[];
    extensions: BuildingData[];
    towers: BuildingData[];
    labs: BuildingData[];
    links: BuildingData[];
    spawns: BuildingData[];
    containers: BuildingData[];
    storage: BuildingData;
    terminal: BuildingData;
    factory: BuildingData;
    powerspawn: BuildingData;
    nuker: BuildingData;
    observer: BuildingData;
    extractor: BuildingData;
}
export interface BuildingData {
    pos: number;
    id?: Id<Structure | ConstructionSite>;
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
                        room.memory.genBuildings = GenerateBuildingsData(Game.rooms[room.name]);
                        UpdateBuildingsData(Game.rooms[room.name]);
                        BuildBuildings(Game.rooms[room.name]);
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

            // Update buildings data every 500 ticks
            RunEvery(
                () => {
                    UpdateBuildingsData(room);
                },
                "layouthandlerupdatebuildinsdata" + room.name,
                500
            );

            // Build buildings every 50 ticks
            RunEvery(
                () => {
                    BuildBuildings(room);
                },
                "layouthandlerbuildbuildings" + room.name,
                50
            );
        }
    }
}

function GenerateBuildingsData(room: Room): GenBuildingsData | undefined {
    if (room.memory.genLayout === undefined || room.memory.remoteData === undefined) {
        return undefined;
    }

    let roads: BuildingData[] = [];
    let ramparts: BuildingData[] = [];
    let extensions: BuildingData[] = [];
    let towers: BuildingData[] = [];
    let labs: BuildingData[] = [];
    let links: BuildingData[] = [];
    let spawns: BuildingData[] = [];
    let containers: BuildingData[] = [];
    let storage: BuildingData | undefined = undefined;
    let terminal: BuildingData | undefined = undefined;
    let factory: BuildingData | undefined = undefined;
    let powerspawn: BuildingData | undefined = undefined;
    let nuker: BuildingData;
    let observer: BuildingData;
    let extractor: BuildingData;

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
    const baseRoom = room;
    const basePos = new RoomPosition(room.memory.genLayout.prefabs[0].x, room.memory.genLayout.prefabs[0].y, room.name);
    const roadCostMatrix = (roomName: string): boolean | CostMatrix => {
        const room = Game.rooms[roomName];

        let isRemote = false;
        if (roomName !== basePos.roomName) {
            if (Memory.rooms[basePos.roomName].remotes === undefined) {
                return false;
            }
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

        if (!isRemote && room.memory.genLayout !== undefined) {
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

            for (const [i, source] of room.memory.genLayout.sources.entries()) {
                const containerPos = offsetPositionByDirection(
                    unpackPosition(room.memory.basicRoomData.sources[i].pos),
                    source.container
                );
                costs.set(containerPos.x, containerPos.y, 255);
                const linkPos = offsetPositionByDirection(containerPos, source.link);
                costs.set(linkPos.x, linkPos.y, 255);
            }
        }
        if (isRemote && baseRoom.memory.remoteData !== undefined) {
            if (baseRoom.memory.remoteData.data[roomName] !== undefined) {
                for (const source of baseRoom.memory.remoteData.data[roomName].sources) {
                    const pos = offsetPositionByDirection(unpackPosition(source.pos), source.container);
                    costs.set(pos.x, pos.y, 255);
                }
            }
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
                    maxOps: 10000,
                    roomCallback: roadCostMatrix,
                    plainCost: 2,
                    swampCost: 4
                }
            );

            if (search.incomplete === true) {
                console.log("incomplete path " + remote + " " + source.id);
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
        room.memory.genBuildings.containers[0].active = false;
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

function BuildBuildings(room: Room): void {
    if (room.memory.genBuildings === undefined) {
        return;
    }

    if (room.find(FIND_MY_SPAWNS).length === 0) {
        for (const spawn of room.memory.genBuildings.spawns) {
            BuildBuilding(spawn, STRUCTURE_SPAWN, room.name);
        }
        return;
    }

    for (const extension of room.memory.genBuildings.extensions) {
        BuildBuilding(extension, STRUCTURE_EXTENSION, room.name);
    }
    for (const tower of room.memory.genBuildings.towers) {
        BuildBuilding(tower, STRUCTURE_TOWER, room.name);
    }
    for (const lab of room.memory.genBuildings.labs) {
        BuildBuilding(lab, STRUCTURE_LAB, room.name);
    }
    for (const link of room.memory.genBuildings.links) {
        BuildBuilding(link, STRUCTURE_LINK, room.name);
    }
    for (const spawn of room.memory.genBuildings.spawns) {
        BuildBuilding(spawn, STRUCTURE_SPAWN, room.name);
    }
    for (const container of room.memory.genBuildings.containers) {
        BuildBuilding(container, STRUCTURE_CONTAINER, room.name);
    }

    BuildBuilding(room.memory.genBuildings.storage, STRUCTURE_STORAGE, room.name);
    BuildBuilding(room.memory.genBuildings.terminal, STRUCTURE_TERMINAL, room.name);
    BuildBuilding(room.memory.genBuildings.factory, STRUCTURE_FACTORY, room.name);
    BuildBuilding(room.memory.genBuildings.powerspawn, STRUCTURE_POWER_SPAWN, room.name);
    BuildBuilding(room.memory.genBuildings.nuker, STRUCTURE_NUKER, room.name);
    BuildBuilding(room.memory.genBuildings.observer, STRUCTURE_OBSERVER, room.name);
    BuildBuilding(room.memory.genBuildings.extractor, STRUCTURE_EXTRACTOR, room.name);

    for (const road of room.memory.genBuildings.roads) {
        BuildBuilding(road, STRUCTURE_ROAD, room.name);
    }

    for (const rampart of room.memory.genBuildings.ramparts) {
        BuildBuilding(rampart, STRUCTURE_RAMPART, room.name);
    }
}

function BuildBuilding<T extends BuildableStructureConstant>(
    building: BuildingData,
    type: BuildableStructureConstant,
    roomName: string
): void {
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
        return;
    }
    const baseRoom = Game.rooms[roomName];
    if (baseRoom === undefined) {
        return;
    }
    const pos: RoomPosition = unpackPosition(building.pos);
    const room: Room = Game.rooms[pos.roomName];
    if (room === undefined) {
        return;
    }

    if (building.rampart !== undefined && Object.keys(Game.spawns).length > 0) {
        if (building.rampart.id !== undefined) {
            if (
                Game.rooms[unpackPosition(building.pos).roomName] !== undefined &&
                Game.getObjectById(building.rampart.id) === null
            ) {
                building.rampart.id = undefined;
            }
        }
        if (building.rampart.id === undefined) {
            let hasRampart: boolean = false;
            const structures: Structure<StructureConstant>[] = pos.lookFor(LOOK_STRUCTURES);
            for (const structure of structures) {
                if (structure.structureType === STRUCTURE_RAMPART) {
                    building.rampart.id = structure.id as Id<Structure<STRUCTURE_RAMPART>>;
                    hasRampart = true;
                    break;
                }
            }

            if (!hasRampart) {
                const placedCS = baseRoom.memory.placedCS;
                const plannedCS = baseRoom.memory.plannedCS;

                for (const site of placedCS) {
                    if (site.pos === building.pos && site.type === STRUCTURE_RAMPART) {
                        building.rampart.id = site.id as Id<ConstructionSite<STRUCTURE_RAMPART>>;
                        hasRampart = true;
                        break;
                    }
                }
                for (const site of plannedCS) {
                    if (site.pos === building.pos && site.type === STRUCTURE_RAMPART) {
                        hasRampart = true;
                        break;
                    }
                }
            }

            if (!hasRampart) {
                room.memory.plannedCS.push({
                    pos: building.pos,
                    type: STRUCTURE_RAMPART
                });
                return;
            }
        }
    }
    if (building.id !== undefined) {
        if (Game.rooms[unpackPosition(building.pos).roomName] === undefined) {
            return;
        }

        const obj = Game.getObjectById(building.id);

        if (obj !== null) {
            if (obj instanceof ConstructionSite) {
                const structures: Structure<StructureConstant>[] = pos.lookFor(LOOK_STRUCTURES);
                for (const structure of structures) {
                    if (structure.structureType === type) {
                        building.id = structure.id as Id<Structure<T>>;
                        return;
                    }
                }
            }
            // we already have a structure/constructionSite for this building
            return;
        }
        building.id = undefined;
    }

    const structures: Structure<StructureConstant>[] = pos.lookFor(LOOK_STRUCTURES);
    for (const structure of structures) {
        if (structure.structureType === type) {
            building.id = structure.id as Id<Structure<T>>;
            return;
        }
    }

    const placedCS = baseRoom.memory.placedCS;
    const plannedCS = baseRoom.memory.plannedCS;
    for (const site of placedCS) {
        if (site.pos === building.pos && site.type === type) {
            building.id = site.id;
            return;
        }
    }
    for (const site of plannedCS) {
        if (site.pos === building.pos && site.type === type) {
            return;
        }
    }

    baseRoom.memory.plannedCS.push({
        pos: building.pos,
        type: type,
        name: building.name
    });
}

function removeDuplicates(array: BuildingData[]): BuildingData[] {
    let seen: { [key in string]: boolean } = {};
    return array.filter((value) => {
        return seen.hasOwnProperty(value.pos) ? false : (seen[value.pos] = true);
    });
}
