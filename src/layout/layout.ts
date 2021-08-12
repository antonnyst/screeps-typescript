import { applyDistanceTransform, buildableSquares, displayCostMatrix } from "algorithms/distanceTransform";
import { applyFloodFill, floodFill } from "algorithms/floodFill";
import { get_matrix, min_cut } from "algorithms/minCut";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { packPosition, unpackPosition } from "utils/RoomPositionPacker";
import { centerPrefab, labArrayPrefab, LayoutPrefab, quickFillPrefab } from "./prefabs";

export interface GenLayoutData {
    prefabs: LayoutPrefabData[];
    towers: number[];
    extensions: number[];
    roads: number[];
    ramparts: number[];
    observer: number;
    nuker: number;
    sources: SourceData[];
    mineral: MineralData;
    controller: number;
}

interface SourceData {
    dist: number;
    container: DirectionConstant;
    link: DirectionConstant;
}
interface MineralData {
    dist: number;
    container: DirectionConstant;
}

export interface BasicRoomData {
    controller: number | null;
    sources: { pos: number; id: Id<Source> }[];
    mineral: { pos: number; id: Id<Mineral> } | null;
}

interface LayoutPrefabData {
    prefab: LayoutPrefab;
    x: number;
    y: number;
    rotx: number;
    roty: number;
}
// [centerPrefabRotX, centerPrefabRotY, labDeltaX, labDeltaY, labRotX, labRotY]
const baseRotations = [
    [1, 1, -1, -1, -1, 1],
    [1, 1, 1, -2, 1, 1],
    [-1, -1, 1, 1, 1, -1],
    [-1, -1, -1, 2, -1, -1]
];

// Create a GenLayoutData from a BasicRoomData and a corresponding roomName
// The functions works by placing the prefabs and slowly building up the base and checking the fitness after every step t
// to eliminate bad choices
export function* generateLayout(basicLayout: BasicRoomData, roomName: string) {
    const terrain: RoomTerrain = Game.map.getRoomTerrain(roomName);
    const m: CostMatrix = buildableSquares(roomName);

    for (const source of basicLayout.sources) {
        const p = unpackPosition(source.pos);
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                m.set(p.x + dx, p.y + dy, 0);
            }
        }
    }
    if (basicLayout.controller !== null) {
        const p = unpackPosition(basicLayout.controller);
        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                m.set(p.x + dx, p.y + dy, 0);
            }
        }
    }
    if (basicLayout.mineral !== null) {
        const p = unpackPosition(basicLayout.mineral.pos);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                m.set(p.x + dx, p.y + dy, 0);
            }
        }
    }

    const dt: CostMatrix = applyDistanceTransform(m);

    yield null;

    // Find potential base center and lab locations
    // Every tile with dt > 2 works as a start

    const candidates: GenLayoutData[] = [];

    for (let x = 2; x < 48; x++) {
        for (let y = 2; y < 48; y++) {
            if (dt.get(x, y) === 3 || dt.get(x, y) === 5 || (dt.get(x, y) >= 3 && x % 10 === 0 && y % 10 === 0)) {
                for (let i = 0; i < baseRotations.length; i++) {
                    let fits = true;
                    for (const building of labArrayPrefab.buildings) {
                        const bx = x + baseRotations[i][2] + building.dx * baseRotations[i][4];
                        const by = y + baseRotations[i][3] + building.dy * baseRotations[i][5];
                        if (bx < 5 || bx > 44 || by < 5 || by > 44 || dt.get(bx, by) === 0) {
                            fits = false;
                            break;
                        }
                    }

                    if (fits) {
                        // Calculate miner positions and controller storage position
                        const searchController: PathFinderPath = PathFinder.search(
                            new RoomPosition(x, y, roomName),
                            {
                                pos: unpackPosition(basicLayout.controller!),
                                range: 1
                            },
                            {
                                swampCost: 1,
                                plainCost: 1
                            }
                        );
                        const pathController: RoomPosition[] = searchController.path;
                        const controller: number = packPosition(pathController[pathController.length - 2]);

                        const searchMineral: PathFinderPath = PathFinder.search(
                            new RoomPosition(x, y, roomName),
                            {
                                pos: unpackPosition(basicLayout.mineral!.pos),
                                range: 1
                            },
                            {
                                swampCost: 1,
                                plainCost: 1
                            }
                        );
                        const pathMineral = searchMineral.path;
                        const mineral: DirectionConstant = unpackPosition(basicLayout.mineral!.pos).getDirectionTo(
                            pathMineral[pathMineral.length - 1]
                        );

                        const sources: SourceData[] = [];
                        for (const source of basicLayout.sources) {
                            const searchSource: PathFinderPath = PathFinder.search(
                                new RoomPosition(x, y, roomName),
                                {
                                    pos: unpackPosition(source.pos),
                                    range: 1
                                },
                                {
                                    swampCost: 1,
                                    plainCost: 1
                                }
                            );
                            const pathSource = searchSource.path;
                            const container = unpackPosition(source.pos).getDirectionTo(
                                pathSource[pathSource.length - 1]
                            );
                            const roadDir = pathSource[pathSource.length - 1].getDirectionTo(
                                pathSource[pathSource.length - 2]
                            );
                            let link: DirectionConstant = 1;
                            for (let i = 1; i <= 8; i++) {
                                if (roadDir === i) {
                                    continue;
                                }
                                const p = offsetPositionByDirection(
                                    pathSource[pathSource.length - 1],
                                    i as DirectionConstant
                                );
                                if (terrain.get(p.x, p.y) === TERRAIN_MASK_WALL) {
                                    continue;
                                }
                                link = i as DirectionConstant;
                                break;
                            }

                            const s: SourceData = {
                                dist: -1,
                                container,
                                link
                            };
                            sources.push(s);
                        }

                        const layout: GenLayoutData = {
                            prefabs: [
                                {
                                    prefab: centerPrefab,
                                    x,
                                    y,
                                    rotx: baseRotations[i][0],
                                    roty: baseRotations[i][1]
                                },
                                {
                                    prefab: labArrayPrefab,
                                    x: x + baseRotations[i][2],
                                    y: y + baseRotations[i][3],
                                    rotx: baseRotations[i][4],
                                    roty: baseRotations[i][5]
                                }
                            ],
                            towers: [],
                            extensions: [],
                            roads: [],
                            ramparts: [],
                            sources,
                            nuker: 0,
                            observer: 0,
                            mineral: {
                                dist: -1,
                                container: mineral
                            },
                            controller
                        };
                        candidates.push(layout);
                        for (let dx = -2; dx <= 2; dx++) {
                            for (let dy = -2; dy <= 2; dy++) {
                                dt.set(x + dx, y + dy, 1);
                            }
                        }
                    }
                }
            }
        }
    }

    yield null;

    // Calculate candidate fitness
    let candidatesFitness: { p: GenLayoutData; v: number }[] = [];

    for (const candidate of candidates) {
        const a = fitness(basicLayout, candidate, roomName);

        let b = 0;
        for (const source of basicLayout.sources) {
            const p = unpackPosition(source.pos);
            b += p.getRangeTo(candidate.prefabs[0].x, candidate.prefabs[0].y);
        }
        b +=
            basicLayout.controller !== null
                ? unpackPosition(basicLayout.controller).getRangeTo(candidate.prefabs[0].x, candidate.prefabs[0].y)
                : 0;

        const tf = a + b * 0.2;

        candidatesFitness.push({
            p: candidate,
            v: tf
        });

        yield "done for " + candidate.prefabs[0].x + "/" + candidate.prefabs[0].y + " with fitness " + tf;
    }

    yield null;

    // Sort candidates and keep best 10
    candidatesFitness.sort((a, b) => a.v - b.v);
    candidatesFitness.splice(10);

    yield null;

    // Choose a spot for quickfill prototype
    for (const candidate of candidatesFitness) {
        const matrix: CostMatrix = m.clone();

        for (const prefab of candidate.p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                if (building.type !== STRUCTURE_ROAD) {
                    const x = prefab.x + building.dx * prefab.rotx;
                    const y = prefab.y + building.dy * prefab.roty;
                    matrix.set(x, y, 0);
                }
            }
        }

        let distance = 2;
        for (let x = distance; x <= 49 - distance; x++) {
            for (let y = distance; y <= 49 - distance; y++) {
                if (x === distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(0, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
                if (x === 49 - distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(49, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 0) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === 49 - distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 49) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
            }
        }
        distance = 3;
        for (let x = distance; x <= 49 - distance; x++) {
            for (let y = distance; y <= 49 - distance; y++) {
                if (x === distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(0, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
                if (x === 49 - distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(49, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 0) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === 49 - distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 49) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
            }
        }
        distance = 4;
        for (let x = distance; x <= 49 - distance; x++) {
            for (let y = distance; y <= 49 - distance; y++) {
                if (x === distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(0, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
                if (x === 49 - distance) {
                    let found = false;
                    for (let dy = -distance; dy <= distance; dy++) {
                        if (terrain.get(49, y - dy) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 0) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }

                if (y === 49 - distance) {
                    let found = false;
                    for (let dx = -distance; dx <= distance; dx++) {
                        if (terrain.get(x - dx, 49) !== TERRAIN_MASK_WALL) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        matrix.set(x, y, 0);
                    }
                }
            }
        }

        const dist: CostMatrix = applyDistanceTransform(matrix);

        // Search in a spiral to find closest dist values >= 5
        let foundLocations: number[][] = [];
        let stopSize: number | null = null;

        for (let spiralSize = 1; spiralSize <= 8; spiralSize++) {
            if (stopSize !== null && spiralSize > stopSize) {
                break;
            }
            let dx = -spiralSize;
            let dy = -spiralSize;
            for (let i = 0; i < spiralSize * 2; i++) {
                if (dist.get(candidate.p.prefabs[0].x + dx, candidate.p.prefabs[0].y + dy) >= 4) {
                    if (stopSize === null) {
                        stopSize = spiralSize;
                    }
                    foundLocations.push([dx, dy]);
                }
                dx += 1;
            }
            for (let i = 0; i < spiralSize * 2; i++) {
                if (dist.get(candidate.p.prefabs[0].x + dx, candidate.p.prefabs[0].y + dy) >= 4) {
                    if (stopSize === null) {
                        stopSize = spiralSize;
                    }
                    foundLocations.push([dx, dy]);
                }
                dy += 1;
            }
            for (let i = 0; i < spiralSize * 2; i++) {
                if (dist.get(candidate.p.prefabs[0].x + dx, candidate.p.prefabs[0].y + dy) >= 4) {
                    if (stopSize === null) {
                        stopSize = spiralSize;
                    }
                    foundLocations.push([dx, dy]);
                }
                dx -= 1;
            }
            for (let i = 0; i < spiralSize * 2 - 1; i++) {
                if (dist.get(candidate.p.prefabs[0].x + dx, candidate.p.prefabs[0].y + dy) >= 4) {
                    if (stopSize === null) {
                        stopSize = spiralSize;
                    }
                    foundLocations.push([dx, dy]);
                }
                dy -= 1;
            }

            yield null;
        }

        // Test all found locations

        const locationFitness = [];

        for (const location of foundLocations) {
            const x = candidate.p.prefabs[0].x + location[0];
            const y = candidate.p.prefabs[0].y + location[1];
            const layout: GenLayoutData = {
                prefabs: [
                    candidate.p.prefabs[0],
                    candidate.p.prefabs[1],
                    {
                        prefab: quickFillPrefab,
                        x,
                        y,
                        rotx: 1,
                        roty: 1
                    }
                ],
                towers: [],
                extensions: [],
                roads: [],
                ramparts: [],
                nuker: 0,
                observer: 0,
                sources: candidate.p.sources,
                mineral: candidate.p.mineral,
                controller: candidate.p.controller
            };
            const range = Math.abs(location[0]) + Math.abs(location[1]);
            const f = fitness(basicLayout, layout, roomName) + range * 2;
            locationFitness.push({
                p: location,
                v: f
            });
            yield candidate.p.prefabs[0].x + "/" + candidate.p.prefabs[0].y + " : testing found location " + location;
        }

        // And pick the best one

        if (locationFitness.length === 0) {
            candidate.v = -1;
            continue;
        }

        locationFitness.sort((a, b) => a.v - b.v);
        candidate.p.prefabs.push({
            prefab: quickFillPrefab,
            x: candidate.p.prefabs[0].x + locationFitness[0].p[0],
            y: candidate.p.prefabs[0].y + locationFitness[0].p[1],
            rotx: 1,
            roty: 1
        });

        yield null;
    }

    candidatesFitness = candidatesFitness.filter((a) => a.v !== -1);

    yield null;

    // Calculate candidate fitness

    for (const candidate of candidatesFitness) {
        const c = cutLayout(basicLayout, candidate.p, roomName);
        const a = c.length;

        candidate.p.ramparts = c.map((a) => packPosition(new RoomPosition(a.x, a.y, roomName)));

        let b = 0;
        for (const source of basicLayout.sources) {
            const p = unpackPosition(source.pos);
            b += p.getRangeTo(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y);
        }
        b +=
            basicLayout.controller !== null
                ? unpackPosition(basicLayout.controller).getRangeTo(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y)
                : 0;

        const tf = a + b * 0.2;

        candidate.v = tf;

        yield "done for " + candidate.p.prefabs[0].x + "/" + candidate.p.prefabs[0].y + " with fitness " + tf;
    }

    yield null;

    // Sort candidates
    candidatesFitness.sort((a, b) => a.v - b.v);

    yield null;

    // Add roads to layouts
    for (const candidate of candidatesFitness) {
        let roads: number[] = [];

        const roadCostMatrix = (room: string): boolean | CostMatrix => {
            if (room !== roomName) {
                return false;
            }
            const costs = new PathFinder.CostMatrix();
            for (const road of roads) {
                const pos = unpackPosition(road);
                if (pos.roomName === room) {
                    costs.set(pos.x, pos.y, 1);
                }
            }
            for (const prefab of candidate.p.prefabs) {
                for (const building of prefab.prefab.buildings) {
                    if (building.type === STRUCTURE_ROAD) {
                        costs.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 1);
                    } else {
                        costs.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 255);
                    }
                }
            }
            for (let i = 0; i < candidate.p.sources.length; i++) {
                const cpos = offsetPositionByDirection(
                    unpackPosition(basicLayout.sources[i].pos),
                    candidate.p.sources[i].container
                );
                const lpos = offsetPositionByDirection(cpos, candidate.p.sources[i].link);
                costs.set(cpos.x, cpos.y, 255);
                costs.set(lpos.x, lpos.y, 255);
            }
            const mpos = offsetPositionByDirection(
                unpackPosition(basicLayout.mineral!.pos),
                candidate.p.mineral.container
            );
            costs.set(mpos.x, mpos.y, 255);

            const cpos = unpackPosition(candidatesFitness[0].p.controller);
            costs.set(cpos.x, cpos.y, 255);

            return costs;
        };

        const centerLocation = new RoomPosition(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y, roomName);

        yield null;

        const quickFillPath = PathFinder.search(
            centerLocation,
            {
                pos: new RoomPosition(candidate.p.prefabs[2].x, candidate.p.prefabs[2].y, roomName),
                range: 1
            },
            {
                maxOps: 5000,
                plainCost: 2,
                swampCost: 4,
                roomCallback: roadCostMatrix
            }
        ).path;
        roads = roads.concat(quickFillPath.map((a) => packPosition(a)));

        for (let i = 0; i < candidate.p.sources.length; i++) {
            const cpos = offsetPositionByDirection(
                unpackPosition(basicLayout.sources[i].pos),
                candidate.p.sources[i].container
            );
            const sourcePath = PathFinder.search(
                centerLocation,
                {
                    pos: cpos,
                    range: 1
                },
                {
                    maxOps: 5000,
                    plainCost: 2,
                    swampCost: 4,
                    roomCallback: roadCostMatrix
                }
            ).path;
            roads = roads.concat(sourcePath.map((a) => packPosition(a)));
        }

        yield null;

        const controllerPath = PathFinder.search(
            centerLocation,
            {
                pos: unpackPosition(candidate.p.controller),
                range: 1
            },
            {
                maxOps: 5000,
                plainCost: 2,
                swampCost: 4,
                roomCallback: roadCostMatrix
            }
        ).path;
        roads = roads.concat(controllerPath.map((a) => packPosition(a)));

        yield null;

        // Roads to all ramparts

        // Divide all ramparts into parts
        const rampartParts: RoomPosition[][] = [];
        for (const rampart of candidate.p.ramparts) {
            yield null;
            const pos = unpackPosition(rampart);

            let touchingParts: number[] = [];
            for (let i = 0; i < rampartParts.length; i++) {
                for (const r of rampartParts[i]) {
                    if (touchingParts.some((a) => a === i)) {
                        break;
                    }
                    if (pos.getRangeTo(r) === 1) {
                        touchingParts.push(i);
                    }
                }
            }

            if (touchingParts.length > 0) {
                if (touchingParts.length === 1) {
                    rampartParts[touchingParts[0]].push(pos);
                } else {
                    //this pos touches more than one part
                    //combine all parts they touch into one
                    rampartParts[touchingParts[0]].push(pos);
                    for (let i = 1; i < touchingParts.length; i++) {
                        for (const rampart of rampartParts[touchingParts[i]]) {
                            rampartParts[touchingParts[0]].push(rampart);
                        }
                    }
                    for (let i = touchingParts.length - 1; i > 0; i--) {
                        rampartParts.splice(touchingParts[i], 1);
                    }
                }
            } else {
                rampartParts.push([pos]);
            }
        }

        for (const part of rampartParts) {
            yield null;
            const partPath = PathFinder.search(
                centerLocation,
                part.map((a) => {
                    return {
                        pos: a,
                        range: 1
                    };
                }),
                {
                    maxOps: 5000,
                    plainCost: 2,
                    swampCost: 4,
                    roomCallback: roadCostMatrix
                }
            ).path;
            roads = roads.concat(partPath.map((a) => packPosition(a)));
        }

        yield null;

        const mpos = offsetPositionByDirection(unpackPosition(basicLayout.mineral!.pos), candidate.p.mineral.container);
        const mineralPath = PathFinder.search(
            centerLocation,
            {
                pos: mpos,
                range: 1
            },
            {
                maxOps: 5000,
                plainCost: 2,
                swampCost: 4,
                roomCallback: roadCostMatrix
            }
        ).path;
        roads = roads.concat(mineralPath.map((a) => packPosition(a)));

        yield null;

        let seen: { [key in string]: boolean } = {};

        for (const prefab of candidate.p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                if (building.type === STRUCTURE_ROAD) {
                    const p = packPosition(
                        new RoomPosition(
                            building.dx * prefab.rotx + prefab.x,
                            building.dy * prefab.roty + prefab.y,
                            roomName
                        )
                    );
                    seen[p] = true;
                }
            }
        }

        roads = roads.filter((r) => {
            return seen.hasOwnProperty(r) ? false : (seen[r] = true);
        });

        candidate.p.roads = roads;
        yield null;
    }

    yield null;

    // Add in the extensions and towers by filling in gaps in the base and adding roads if needed
    for (const candidate of candidatesFitness) {
        let prefabCount = 0;

        for (const prefab of candidate.p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                if (building.type === STRUCTURE_EXTENSION) {
                    prefabCount += 1;
                }
            }
        }

        let targetCount =
            CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8] + CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8] - prefabCount + 2;
        //+2 for nuker + observer

        let foundLocations: { x: number; y: number }[] = [];

        do {
            const matrix: CostMatrix = new PathFinder.CostMatrix();

            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    matrix.set(x, y, 1);
                }
            }

            for (const road of candidate.p.roads) {
                const pos = unpackPosition(road);
                matrix.set(pos.x, pos.y, 0);
            }

            for (const prefab of candidate.p.prefabs) {
                for (const building of prefab.prefab.buildings) {
                    if (building.type === STRUCTURE_ROAD) {
                        matrix.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 0);
                    }
                }
            }

            const dist: CostMatrix = applyDistanceTransform(matrix);

            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                        dist.set(x, y, 0);
                    }
                }
            }

            for (const prefab of candidate.p.prefabs) {
                for (const building of prefab.prefab.buildings) {
                    dist.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 0);
                }
            }

            dist.set(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y, 0);

            if (candidate.p.prefabs.length >= 3) {
                dist.set(candidate.p.prefabs[2].x - 1, candidate.p.prefabs[2].y - 1, 0);
                dist.set(candidate.p.prefabs[2].x + 1, candidate.p.prefabs[2].y + 1, 0);
                dist.set(candidate.p.prefabs[2].x - 1, candidate.p.prefabs[2].y + 1, 0);
                dist.set(candidate.p.prefabs[2].x + 1, candidate.p.prefabs[2].y - 1, 0);
            }

            for (let i = 0; i < candidate.p.sources.length; i++) {
                const cpos = offsetPositionByDirection(
                    unpackPosition(basicLayout.sources[i].pos),
                    candidate.p.sources[i].container
                );
                const lpos = offsetPositionByDirection(cpos, candidate.p.sources[i].link);
                dist.set(cpos.x, cpos.y, 0);
                dist.set(lpos.x, lpos.y, 0);
            }
            const mpos = offsetPositionByDirection(
                unpackPosition(basicLayout.mineral!.pos),
                candidate.p.mineral.container
            );
            dist.set(mpos.x, mpos.y, 0);

            const controllerPos = unpackPosition(candidate.p.controller);
            dist.set(controllerPos.x, controllerPos.y, 0);

            let damageMatrix: CostMatrix = floodFill(
                roomName,
                candidate.p.ramparts.map((a) => {
                    const pos = unpackPosition(a);
                    return {
                        x: pos.x,
                        y: pos.y
                    };
                })
            );

            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    if (damageMatrix.get(x, y) === 0) {
                        for (let dx = -3; dx <= 3; dx++) {
                            let b = false;
                            for (let dy = -3; dy <= 3; dy++) {
                                if (damageMatrix.get(x + dx, y + dy) === 1) {
                                    damageMatrix.set(x, y, 2);
                                    b = true;
                                    break;
                                }
                            }
                            if (b) {
                                break;
                            }
                        }
                    }
                }
            }

            // count possible locations
            foundLocations = [];
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    if (dist.get(x, y) === 1 && damageMatrix.get(x, y) === 0) {
                        foundLocations.push({ x, y });
                    }
                }
            }

            //displayBase(roomName, basicLayout, candidate.p);

            //Game.time % 5 >= 2 ? displayCostMatrix(dist, roomName) : displayCostMatrix(damageMatrix, roomName);

            //console.log("Count = " + foundLocations.length + " < " + targetCount);

            if (foundLocations.length < targetCount) {
                // choose from already found locations and turn one of them into a road

                let bestCount: number = 1;
                let bestRange: number = Infinity;
                let bestPos: { x: number; y: number } | undefined = undefined;

                for (let location of foundLocations) {
                    let neighborCount = 0;
                    let range = new RoomPosition(location.x, location.y, roomName).getRangeTo(
                        candidate.p.prefabs[0].x,
                        candidate.p.prefabs[0].y
                    );
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (
                                dist.get(location.x + dx, location.y + dy) === 2 &&
                                damageMatrix.get(location.x + dx, location.y + dy) === 0
                            ) {
                                neighborCount++;
                            }
                        }
                    }
                    if (neighborCount > bestCount || (neighborCount === bestCount && range < bestRange)) {
                        bestCount = neighborCount;
                        bestRange = range;
                        bestPos = location;
                    }
                }

                if (bestCount > 1 && bestPos !== undefined) {
                    candidate.p.roads.push(packPosition(new RoomPosition(bestPos.x, bestPos.y, roomName)));
                } else {
                    bestCount = 1;
                    bestRange = Infinity;
                    bestPos = undefined;
                    let newLocations: { x: number; y: number }[] = [];

                    for (let location of foundLocations) {
                        let neighborCount = 0;
                        let range = new RoomPosition(location.x, location.y, roomName).getRangeTo(
                            candidate.p.prefabs[0].x,
                            candidate.p.prefabs[0].y
                        );
                        let l = [];
                        for (let dx = -1; dx <= 1; dx++) {
                            for (let dy = -1; dy <= 1; dy++) {
                                if (
                                    dist.get(location.x + dx, location.y + dy) === 2 &&
                                    damageMatrix.get(location.x + dx, location.y + dy) !== 1
                                ) {
                                    neighborCount++;
                                    l.push({
                                        x: location.x + dx,
                                        y: location.y + dy
                                    });
                                }
                            }
                        }
                        if (neighborCount > bestCount || (neighborCount === bestCount && range < bestRange)) {
                            newLocations = l;
                            bestRange = range;
                            bestCount = neighborCount;
                            bestPos = location;
                        }
                    }

                    if (bestCount > 1 && bestPos !== undefined) {
                        //console.log("trying " + bestPos);
                        candidate.p.roads.push(packPosition(new RoomPosition(bestPos.x, bestPos.y, roomName)));
                        foundLocations = foundLocations.concat(newLocations);
                        const cut = cutLayout(basicLayout, candidate.p, roomName, foundLocations);
                        candidate.p.ramparts = cut.map((a) => packPosition(new RoomPosition(a.x, a.y, roomName)));
                    } else {
                        bestCount = 1;
                        bestRange = Infinity;
                        bestPos = undefined;
                        let newLocations: { x: number; y: number }[] = [];

                        for (let location of foundLocations) {
                            let neighborCount = 0;
                            let range = new RoomPosition(location.x, location.y, roomName).getRangeTo(
                                candidate.p.prefabs[0].x,
                                candidate.p.prefabs[0].y
                            );
                            let l = [];
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    if (
                                        (dist.get(location.x + dx, location.y + dy) === 2 ||
                                            dist.get(location.x + dx, location.y + dy) === 1) &&
                                        damageMatrix.get(location.x + dx, location.y + dy) !== 1
                                    ) {
                                        neighborCount++;
                                        l.push({
                                            x: location.x + dx,
                                            y: location.y + dy
                                        });
                                    }
                                }
                            }
                            if (neighborCount > bestCount || (neighborCount === bestCount && range < bestRange)) {
                                newLocations = l;
                                bestRange = range;
                                bestCount = neighborCount;
                                bestPos = location;
                            }
                        }

                        if (bestCount > 1 && bestPos !== undefined) {
                            //console.log("trying " + bestPos);
                            candidate.p.roads.push(packPosition(new RoomPosition(bestPos.x, bestPos.y, roomName)));
                            foundLocations = foundLocations.concat(newLocations);
                            const cut = cutLayout(basicLayout, candidate.p, roomName, foundLocations);
                            candidate.p.ramparts = cut.map((a) => packPosition(new RoomPosition(a.x, a.y, roomName)));
                        }
                    }
                }
            }
            yield null;
        } while (foundLocations.length < targetCount);

        const matrix: CostMatrix = new PathFinder.CostMatrix();

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                matrix.set(x, y, 1);
            }
        }

        for (const road of candidate.p.roads) {
            const pos = unpackPosition(road);
            matrix.set(pos.x, pos.y, 0);
        }

        for (const prefab of candidate.p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                if (building.type === STRUCTURE_ROAD) {
                    matrix.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 0);
                }
            }
        }

        const dist: CostMatrix = applyDistanceTransform(matrix);

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    dist.set(x, y, 0);
                }
            }
        }

        for (const prefab of candidate.p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                dist.set(building.dx * prefab.rotx + prefab.x, building.dy * prefab.roty + prefab.y, 0);
            }
        }

        dist.set(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y, 0);

        if (candidate.p.prefabs.length >= 3) {
            dist.set(candidate.p.prefabs[2].x - 1, candidate.p.prefabs[2].y - 1, 0);
            dist.set(candidate.p.prefabs[2].x + 1, candidate.p.prefabs[2].y + 1, 0);
            dist.set(candidate.p.prefabs[2].x - 1, candidate.p.prefabs[2].y + 1, 0);
            dist.set(candidate.p.prefabs[2].x + 1, candidate.p.prefabs[2].y - 1, 0);
        }

        for (let i = 0; i < candidate.p.sources.length; i++) {
            const cpos = offsetPositionByDirection(
                unpackPosition(basicLayout.sources[i].pos),
                candidate.p.sources[i].container
            );
            const lpos = offsetPositionByDirection(cpos, candidate.p.sources[i].link);
            dist.set(cpos.x, cpos.y, 0);
            dist.set(lpos.x, lpos.y, 0);
        }
        const mpos = offsetPositionByDirection(unpackPosition(basicLayout.mineral!.pos), candidate.p.mineral.container);
        dist.set(mpos.x, mpos.y, 0);

        const controllerPos = unpackPosition(candidate.p.controller);
        dist.set(controllerPos.x, controllerPos.y, 0);

        let damageMatrix: CostMatrix = floodFill(
            roomName,
            candidate.p.ramparts.map((a) => {
                const pos = unpackPosition(a);
                return {
                    x: pos.x,
                    y: pos.y
                };
            })
        );

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (damageMatrix.get(x, y) === 0) {
                    for (let dx = -3; dx <= 3; dx++) {
                        let b = false;
                        for (let dy = -3; dy <= 3; dy++) {
                            if (damageMatrix.get(x + dx, y + dy) === 1) {
                                damageMatrix.set(x, y, 2);
                                b = true;
                                break;
                            }
                        }
                        if (b) {
                            break;
                        }
                    }
                }
            }
        }

        let locations = [];
        // count possible locations
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (dist.get(x, y) === 1 && damageMatrix.get(x, y) === 0) {
                    locations.push({
                        x,
                        y
                    });
                }
            }
        }

        candidate.p.towers = [];
        candidate.p.extensions = [];

        let midPos = { x: candidate.p.prefabs[0].x, y: candidate.p.prefabs[0].y };
        let towerMidPos = { x: 0, y: 0 };

        for (const rampart of candidate.p.ramparts) {
            const a = unpackPosition(rampart);
            towerMidPos.x += a.x;
            towerMidPos.y += a.y;
        }

        towerMidPos.x /= candidate.p.ramparts.length;
        towerMidPos.y /= candidate.p.ramparts.length;

        locations.sort((a, b) => {
            const aRange = new RoomPosition(a.x, a.y, roomName).getRangeTo(midPos.x, midPos.y);
            const bRange = new RoomPosition(b.x, b.y, roomName).getRangeTo(midPos.x, midPos.y);
            return aRange - bRange;
        });

        candidate.p.nuker = packPosition(new RoomPosition(locations[0].x, locations[0].y, roomName));

        locations.shift();

        locations.splice(targetCount - 1);

        locations.sort((a, b) => {
            const aRange = new RoomPosition(a.x, a.y, roomName).getRangeTo(towerMidPos.x, towerMidPos.y);
            const bRange = new RoomPosition(b.x, b.y, roomName).getRangeTo(towerMidPos.x, towerMidPos.y);
            return aRange - bRange;
        });

        for (let i = 0; i < Math.min(locations.length, CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8]); i++) {
            candidate.p.towers.push(packPosition(new RoomPosition(locations[i].x, locations[i].y, roomName)));
        }

        locations.splice(0, CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8]);

        locations.sort((a, b) => {
            const aRange = new RoomPosition(a.x, a.y, roomName).getRangeTo(midPos.x, midPos.y);
            const bRange = new RoomPosition(b.x, b.y, roomName).getRangeTo(midPos.x, midPos.y);
            return aRange - bRange;
        });

        for (
            let i = 0;
            i < Math.min(locations.length, targetCount - CONTROLLER_STRUCTURES[STRUCTURE_TOWER][8] - 1);
            i++
        ) {
            candidate.p.extensions.push(packPosition(new RoomPosition(locations[i].x, locations[i].y, roomName)));
        }
        candidate.p.observer = packPosition(
            new RoomPosition(locations[locations.length - 1].x, locations[locations.length - 1].y, roomName)
        );
    }

    yield null;

    // Calculate candidate fitness

    for (const candidate of candidatesFitness) {
        const a = fitness(basicLayout, candidate.p, roomName);

        let b = 0;
        for (const source of basicLayout.sources) {
            const p = unpackPosition(source.pos);
            b += p.getRangeTo(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y);
        }
        b +=
            basicLayout.controller !== null
                ? unpackPosition(basicLayout.controller).getRangeTo(candidate.p.prefabs[0].x, candidate.p.prefabs[0].y)
                : 0;

        const tf = a + b * 0.2;

        candidate.v = tf;

        yield "done for " + candidate.p.prefabs[0].x + "/" + candidate.p.prefabs[0].y + " with fitness " + tf;
    }

    yield null;

    // Sort candidates
    candidatesFitness.sort((a, b) => a.v - b.v);

    yield null;

    const basePos = new RoomPosition(
        candidatesFitness[0].p.prefabs[0].x,
        candidatesFitness[0].p.prefabs[0].y,
        roomName
    );
    const roadCostMatrix = (roomN: string): boolean | CostMatrix => {
        const room = Game.rooms[roomN];

        if (roomN !== roomName) {
            return false;
        }

        const costs = new PathFinder.CostMatrix();

        for (const road of candidatesFitness[0].p.roads) {
            const pos = unpackPosition(road);
            if (pos.roomName === roomName) {
                costs.set(pos.x, pos.y, 1);
            }
        }

        for (const prefab of candidatesFitness[0].p.prefabs) {
            for (const building of prefab.prefab.buildings) {
                if (building.type !== STRUCTURE_ROAD) {
                    costs.set(prefab.x + building.dx * prefab.rotx, prefab.y + building.dy * prefab.roty, 255);
                }
            }
        }
        for (const extension of candidatesFitness[0].p.extensions) {
            const pos = unpackPosition(extension);
            costs.set(pos.x, pos.y, 255);
        }
        for (const tower of candidatesFitness[0].p.towers) {
            const pos = unpackPosition(tower);
            costs.set(pos.x, pos.y, 255);
        }

        for (const [i, source] of candidatesFitness[0].p.sources.entries()) {
            const containerPos = offsetPositionByDirection(
                unpackPosition(basicLayout.sources[i].pos),
                source.container
            );
            costs.set(containerPos.x, containerPos.y, 255);
            const linkPos = offsetPositionByDirection(containerPos, source.link);
            costs.set(linkPos.x, linkPos.y, 255);
        }

        const mpos = offsetPositionByDirection(
            unpackPosition(basicLayout.mineral!.pos),
            candidatesFitness[0].p.mineral.container
        );
        costs.set(mpos.x, mpos.y, 255);
        const cpos = unpackPosition(candidatesFitness[0].p.controller);
        costs.set(cpos.x, cpos.y, 255);

        return costs;
    };

    for (const sourceIndex in candidatesFitness[0].p.sources) {
        const containerPos = offsetPositionByDirection(
            unpackPosition(basicLayout.sources[sourceIndex].pos),
            candidatesFitness[0].p.sources[sourceIndex].container
        );

        const search = PathFinder.search(
            basePos,
            {
                pos: containerPos,
                range: 1
            },
            {
                roomCallback: roadCostMatrix,
                plainCost: 2,
                swampCost: 10
            }
        );

        if (search.incomplete === true) {
            continue;
        }

        candidatesFitness[0].p.sources[sourceIndex].dist = search.path.length;
    }

    const mineralContainerPos = offsetPositionByDirection(
        unpackPosition(basicLayout.mineral!.pos),
        candidatesFitness[0].p.mineral.container
    );
    const search = PathFinder.search(
        basePos,
        {
            pos: mineralContainerPos,
            range: 1
        },
        {
            roomCallback: roadCostMatrix,
            plainCost: 2,
            swampCost: 10
        }
    );

    if (search.incomplete === false) {
        candidatesFitness[0].p.mineral.dist = search.path.length;
    }

    yield null;

    candidatesFitness[0].p.ramparts = cutLayout(basicLayout, candidatesFitness[0].p, roomName).map((v) =>
        packPosition(new RoomPosition(v.x, v.y, roomName))
    );

    return candidatesFitness[0].p;
}

function fitness(
    basicLayout: BasicRoomData,
    layout: GenLayoutData,
    roomName: string,
    protect?: { x: number; y: number }[]
): number {
    return cutLayout(basicLayout, layout, roomName, protect).length;
}

function cutLayout(
    basicLayout: BasicRoomData,
    layout: GenLayoutData,
    roomName: string,
    protect?: { x: number; y: number }[]
) {
    const matrix = get_matrix(roomName);

    const vulnurablePositions: { x: number; y: number }[] = [];

    const rectangles = [];

    if (protect !== undefined) {
        for (const p of protect) {
            vulnurablePositions.push(p);
            rectangles.push({
                x1: Math.max(p.x - 3, 3),
                x2: Math.min(p.x + 3, 46),
                y1: Math.max(p.y - 3, 3),
                y2: Math.min(p.y + 3, 46)
            });
        }
    }

    for (const prefab of layout.prefabs) {
        let minX = Infinity;
        let maxX = -1;
        let minY = Infinity;
        let maxY = -1;

        for (const building of prefab.prefab.buildings) {
            const resX = prefab.x + building.dx * prefab.rotx;
            const resY = prefab.y + building.dy * prefab.roty;

            if (building.type !== STRUCTURE_ROAD) {
                vulnurablePositions.push({
                    x: resX,
                    y: resY
                });
            }

            minX = Math.min(resX, minX);
            maxX = Math.max(resX, maxX);
            minY = Math.min(resY, minY);
            maxY = Math.max(resY, maxY);
        }

        rectangles.push({
            x1: Math.max(minX - 3, 3),
            x2: Math.min(maxX + 3, 46),
            y1: Math.max(minY - 3, 3),
            y2: Math.min(maxY + 3, 46)
        });
    }
    for (const tower of layout.towers) {
        const pos = unpackPosition(tower);

        vulnurablePositions.push({
            x: pos.x,
            y: pos.y
        });

        rectangles.push({
            x1: pos.x,
            x2: pos.x,
            y1: pos.y,
            y2: pos.y
        });
    }
    for (const extension of layout.extensions) {
        const pos = unpackPosition(extension);

        vulnurablePositions.push({
            x: pos.x,
            y: pos.y
        });

        rectangles.push({
            x1: Math.max(pos.x - 3, 3),
            x2: Math.min(pos.x + 3, 46),
            y1: Math.max(pos.y - 3, 3),
            y2: Math.min(pos.y + 3, 46)
        });
    }
    if (basicLayout.controller !== null) {
        const p = unpackPosition(basicLayout.controller);
        rectangles.push({
            x1: p.x - 1,
            x2: p.x + 1,
            y1: p.y - 1,
            y2: p.y + 1
        });
        const p2 = unpackPosition(layout.controller);

        vulnurablePositions.push({
            x: p2.x,
            y: p2.y
        });

        rectangles.push({
            x1: p2.x,
            x2: p2.x,
            y1: p2.y,
            y2: p2.y
        });
    }
    for (let i = 0; i < layout.sources.length; i++) {
        const cpos = offsetPositionByDirection(unpackPosition(basicLayout.sources[i].pos), layout.sources[i].container);
        const lpos = offsetPositionByDirection(cpos, layout.sources[i].link);

        vulnurablePositions.push({
            x: cpos.x,
            y: cpos.y
        });

        vulnurablePositions.push({
            x: lpos.x,
            y: lpos.y
        });

        rectangles.push({
            x1: cpos.x,
            x2: cpos.x,
            y1: cpos.y,
            y2: cpos.y
        });
        rectangles.push({
            x1: lpos.x,
            x2: lpos.x,
            y1: lpos.y,
            y2: lpos.y
        });
    }

    let positions = min_cut(matrix, rectangles);

    const floodMatrix = floodFill(roomName, positions);

    for (const position of vulnurablePositions) {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                if (floodMatrix.get(position.x + dx, position.y + dy) === 1) {
                    positions.push(position);
                    break;
                }
            }
        }
    }

    let seen: { [key in string]: boolean } = {};
    positions = positions.filter((r) => {
        return seen.hasOwnProperty(r.x + "-" + r.y) ? false : (seen[r.x + "-" + r.y] = true);
    });

    return positions;
}

export function generateBasicRoomData(room: Room): BasicRoomData {
    const controller = room.controller !== undefined ? packPosition(room.controller.pos) : null;

    const sourceObjects = room.find(FIND_SOURCES);
    const sources = sourceObjects.map((source) => {
        return {
            pos: packPosition(source.pos),
            id: source.id
        };
    });

    const mineralObject = room.find(FIND_MINERALS);
    const mineral =
        mineralObject.length > 0 ? { pos: packPosition(mineralObject[0].pos), id: mineralObject[0].id } : null;

    return {
        controller,
        sources,
        mineral
    };
}

export function displayBase(roomName: string, basicData: BasicRoomData, layout: GenLayoutData) {
    const mpos = offsetPositionByDirection(unpackPosition(basicData.mineral!.pos), layout.mineral.container);
    const controllerPos = unpackPosition(layout.controller);

    for (const prefab of layout.prefabs) {
        for (const building of prefab.prefab.buildings) {
            const x = prefab.x + building.dx * prefab.rotx;
            const y = prefab.y + building.dy * prefab.roty;

            if (building.type === STRUCTURE_ROAD) {
                Game.rooms[roomName].visual.circle(x, y, { opacity: 0.5, radius: 0.1, fill: "#aaaaaa" });
            } else if (building.type === STRUCTURE_TERMINAL) {
                Game.rooms[roomName].visual.circle(x, y, { opacity: 0.5, radius: 0.4, fill: "#ffaaaa" });
            } else if (building.type === STRUCTURE_EXTENSION) {
                Game.rooms[roomName].visual.circle(x, y, { opacity: 0.5, radius: 0.4, fill: "#ffffaa" });
            } else {
                Game.rooms[roomName].visual.circle(x, y, { opacity: 0.5, radius: 0.4, fill: "#aaaaaa" });
            }
        }
    }

    for (const road of layout.roads) {
        const p = unpackPosition(road);
        Game.rooms[roomName].visual.circle(p.x, p.y, { opacity: 0.5, radius: 0.1, fill: "#aaaaaa" });
    }

    for (const rampart of layout.ramparts) {
        const p = unpackPosition(rampart);
        Game.rooms[roomName].visual.circle(p.x, p.y, { opacity: 0.5, radius: 0.2, fill: "#00ff00" });
    }

    for (let i = 0; i < layout.sources.length; i++) {
        const cpos = offsetPositionByDirection(unpackPosition(basicData.sources[i].pos), layout.sources[i].container);
        const lpos = offsetPositionByDirection(cpos, layout.sources[i].link);

        Game.rooms[roomName].visual.circle(cpos.x, cpos.y, { opacity: 0.5, radius: 0.1, fill: "#00ffff" });
        Game.rooms[roomName].visual.circle(lpos.x, lpos.y, { opacity: 0.5, radius: 0.1, fill: "#00ffff" });
    }

    for (const extension of layout.extensions) {
        const p = unpackPosition(extension);
        Game.rooms[roomName].visual.circle(p.x, p.y, { opacity: 0.5, radius: 0.4, fill: "#ffffaa" });
    }

    for (const tower of layout.towers) {
        const p = unpackPosition(tower);
        Game.rooms[roomName].visual.circle(p.x, p.y, { opacity: 0.5, radius: 0.4, fill: "#ffaaff" });
    }

    const observer = unpackPosition(layout.observer);
    const nuker = unpackPosition(layout.nuker);
    Game.rooms[roomName].visual.circle(observer.x, observer.y, { opacity: 0.5, radius: 0.3, fill: "#00aaff" });
    Game.rooms[roomName].visual.circle(nuker.x, nuker.y, { opacity: 0.5, radius: 0.3, fill: "#00ffff" });

    Game.rooms[roomName].visual.circle(mpos.x, mpos.y, { opacity: 0.5, radius: 0.1, fill: "#00ffff" });
    Game.rooms[roomName].visual.circle(controllerPos.x, controllerPos.y, {
        opacity: 0.5,
        radius: 0.1,
        fill: "#00ffff"
    });
}
