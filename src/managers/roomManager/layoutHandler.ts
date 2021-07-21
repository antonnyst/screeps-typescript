import { BasicSourceData, SourceData, RemoteSourceData } from "../../dataInterfaces/sourceData";
import { unpackPosition, packPosition } from "../../utils/RoomPositionPacker";
import { offsetPositionByDirection } from "../../utils/RoomPositionHelpers";
import { BasicLayoutData, LayoutData, RemoteLayoutData, AutoLayoutData } from "../../dataInterfaces/layoutData";
import { BasicMineralData, MineralData } from "../../dataInterfaces/mineralData";
import { RoadData } from "../../dataInterfaces/roadData";
import { baseCenterLayout } from "../../config/base/baseCenter";
import { bunkerLayout } from "../../config/base/bunker";
import {
    autoLabsLayout,
    autoLabsRotationGuide,
    autoExtensionNodeCount,
    autoExtensionSpawnNode,
    autoExtensionNode
} from "../../config/base/auto";
import { RunEvery, RunNow } from "../../utils/RunEvery";
import { off } from "process";

export function OldLayoutHandler(room: Room, speed: number): void {
    if (room.memory.roomLevel === 2) {
        buildLayout(room);

        if (room.memory.layout === undefined) {
            RunNow(rebuildLayout, "layouthandlergetlayout" + room.name, room);
        }

        RunEvery(rebuildLayout, "layouthandlergetlayout" + room.name, 500 / speed, room);
    }
    if (room.memory.basicLayout === undefined) {
        room.memory.basicLayout = getBasicLayout(room);
    }
}

function rebuildLayout(room: Room) {
    const l = getLayout(room);
    if (l != null) {
        room.memory.layout = l;
    }
}

// newlayout
// create basic layout
// create base layout using basic layout

function getBasicLayout(room: Room): BasicLayoutData {
    const sources: Source[] = room.find(FIND_SOURCES);
    const controller: StructureController | undefined = room.controller;
    const mineral: Mineral = room.find(FIND_MINERALS)[0];

    const basicSources: BasicSourceData[] = sources.map(
        (s): BasicSourceData => {
            return {
                id: s.id,
                pos: packPosition(s.pos)
            };
        }
    );

    const basicMineral: BasicMineralData | undefined =
        mineral !== undefined ? { id: mineral.id, pos: packPosition(mineral.pos) } : undefined;

    const keeperLairs = room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_KEEPER_LAIR
    });
    let lairs: number[] | undefined = undefined;
    if (keeperLairs.length > 0) {
        lairs = keeperLairs.map((v) => packPosition(v.pos));
    }

    return {
        controller: controller !== undefined ? packPosition(controller.pos) : undefined,
        sources: basicSources,
        mineral: basicMineral,
        lairs
    };
}
function getLayout(room: Room): LayoutData | null {
    if (room.controller === undefined) {
        console.log("Cant get layout for no controller rooms");
        return null;
    }
    if (room.memory.basicLayout === undefined) {
        room.memory.basicLayout = getBasicLayout(room);
    }

    const baseType: BaseType | null =
        room.memory.layout === undefined
            ? getBaseType(room.name, room.memory.basicLayout)
            : room.memory.layout.baseType;
    if (baseType === null) {
        return null;
    }

    let centerLocation: RoomPosition | { pos: RoomPosition; dir: LabDirection } | null =
        room.memory.layout === undefined
            ? getCenterLocation(room.name, room.memory.basicLayout, baseType)
            : unpackPosition(room.memory.layout.baseCenter);
    if (centerLocation === null) {
        return null;
    }

    let labDirection: LabDirection | null = null;
    if (!(centerLocation instanceof RoomPosition)) {
        labDirection = centerLocation.dir;
        centerLocation = centerLocation.pos;
    }
    if (
        labDirection === null &&
        room.memory.layout &&
        (room.memory.layout as AutoLayoutData).labDirection !== undefined
    ) {
        labDirection = (room.memory.layout as AutoLayoutData).labDirection;
    }

    const controllerStore: RoomPosition | null =
        room.memory.layout === undefined
            ? getControllerStore(room.memory.basicLayout, centerLocation)
            : unpackPosition(room.memory.layout.controllerStore);
    if (controllerStore === null) {
        return null;
    }

    const sources: SourceData[] | null = getSources(room.memory.basicLayout, centerLocation);
    if (sources === null) {
        return null;
    }
    if (baseType !== "auto") {
        for (const sourceData of sources) {
            sourceData.extensions = [];
        }
    }

    const mineral: MineralData | null = getMineral(room.memory.basicLayout, centerLocation);
    if (mineral === null) {
        return null;
    }

    if (room.memory.remotes.length > 0) {
        for (const roomName of room.memory.remotes) {
            const res = getRemoteLayout(room.name, roomName, centerLocation);
            if (res != null) {
                Memory.rooms[roomName].remoteLayout = res;
            }
        }
    }

    const roads: RoadData[] | null = getRoads(centerLocation, baseType, controllerStore, sources, mineral);
    if (roads === null) {
        return null;
    }

    if (baseType === "bunker") {
        return {
            baseCenter: packPosition(centerLocation),
            controllerStore: packPosition(controllerStore),
            sources,
            mineral,
            roads,
            baseType: "bunker"
        };
    } else if (labDirection != null) {
        const extensions: number[] | null =
            room.memory.layout !== undefined && (room.memory.layout as AutoLayoutData).extensions !== undefined
                ? (room.memory.layout as AutoLayoutData).extensions
                : getAutoExtensionLayout(
                      room.name,
                      { pos: centerLocation, dir: labDirection },
                      room.memory.basicLayout
                  );
        if (extensions === null) {
            return null;
        }
        const ramparts: number[] | null =
            room.memory.layout !== undefined && (room.memory.layout as AutoLayoutData).ramparts !== undefined
                ? (room.memory.layout as AutoLayoutData).ramparts
                : getAutoRamparts(room.name, { pos: centerLocation, dir: labDirection }, extensions);
        if (ramparts === null) {
            return null;
        }
        return {
            baseCenter: packPosition(centerLocation),
            controllerStore: packPosition(controllerStore),
            sources,
            mineral,
            roads,
            baseType: "auto",
            extensions,
            ramparts,
            labDirection
        } as AutoLayoutData;
    }
    return null;
}

function getBaseType(roomName: string, basicLayout: BasicLayoutData): BaseType | null {
    if (getPotentialBunkerCenters(roomName, basicLayout).length > 0) {
        return "bunker";
    }
    if (getPotentialAutoCenters(roomName).length > 0) {
        return "auto";
    }
    console.log("no base types working in " + roomName);
    return null;
}
function getCenterLocation(
    roomName: string,
    basicLayout: BasicLayoutData,
    baseType: BaseType
): RoomPosition | { pos: RoomPosition; dir: LabDirection } | null {
    if (baseType === "bunker") {
        return getBunkerCenterLocation(roomName, basicLayout);
    } else if (baseType === "auto") {
        return getAutoCenterLocation(roomName, basicLayout);
    }
    return null;
}
function getBunkerCenterLocation(roomName: string, basicLayout: BasicLayoutData): RoomPosition | null {
    if (Game.rooms[roomName] !== undefined) {
        if (Game.rooms[roomName].find(FIND_MY_SPAWNS).length === 1) {
            return Game.rooms[roomName].find(FIND_MY_SPAWNS)[0].pos;
        }
    }

    const potentialLocations: RoomPosition[] = getPotentialBunkerCenters(roomName, basicLayout);

    if (potentialLocations.length === 0) {
        console.log("no potential baseCenters in " + roomName);
        return null;
    }

    const locationValues: { pos: RoomPosition; value: number }[] = potentialLocations.map((pos) => {
        const controllerRange = pos.getRangeTo(unpackPosition(basicLayout.controller));
        const sourcesRange = _.sum(
            basicLayout.sources.map((source) => {
                return pos.getRangeTo(unpackPosition(source.pos));
            })
        );

        return {
            pos,
            value: controllerRange + sourcesRange
        };
    });

    locationValues.sort((a, b) => a.value - b.value);

    return locationValues[0].pos;
}
function getAutoCenterLocation(
    roomName: string,
    basicLayout: BasicLayoutData
): { pos: RoomPosition; dir: LabDirection } | null {
    let potentialLocations: { pos: RoomPosition; dir: LabDirection }[] = getPotentialAutoCenters(roomName);

    if (potentialLocations.length === 0) {
        console.log("no potential baseCenters in " + roomName);
        return null;
    }

    let bestCenter: number = -1;
    let bestRampartsYet: number = Infinity;

    if (potentialLocations.length > 75) {
        const val = Math.floor(potentialLocations.length / 75);
        potentialLocations = potentialLocations.filter((e, i) => i % val === 0);
    }

    console.log(potentialLocations.length);

    for (let i = 0; i < potentialLocations.length; i++) {
        const extensions = getAutoExtensionLayout(roomName, potentialLocations[i], basicLayout);
        if (extensions === null) {
            continue;
        }
        const ramparts: number[] | null = getAutoRamparts(roomName, potentialLocations[i], extensions);
        if (ramparts === null) {
            continue;
        }

        const num: number = ramparts.length;

        if (num < bestRampartsYet) {
            bestCenter = i;
            bestRampartsYet = num;
        }
    }
    if (bestCenter >= 0) {
        return potentialLocations[bestCenter];
    }
    return null;
}

function getAutoRamparts(
    roomName: string,
    center: { pos: RoomPosition; dir: LabDirection },
    extensions: number[]
): number[] {
    const terrain = new Room.Terrain(roomName);
    let minX = center.pos.x;
    let minY = center.pos.y;
    let maxX = center.pos.x;
    let maxY = center.pos.y;

    const centerBounds = getAutoCenterBounds()[center.dir];
    const nodeBounds = getAutoExtensionNodeBounds();

    for (const n of centerBounds) {
        if (center.pos.x + n.x < minX) {
            minX = center.pos.x + n.x;
        }
        if (center.pos.x + n.x > maxX) {
            maxX = center.pos.x + n.x;
        }
        if (center.pos.y + n.y < minY) {
            minY = center.pos.y + n.y;
        }
        if (center.pos.y + n.y > maxY) {
            maxY = center.pos.y + n.y;
        }
    }

    for (const ext of extensions) {
        const e = unpackPosition(ext);
        for (const n of nodeBounds) {
            if (e.x + n.x < minX) {
                minX = e.x + n.x;
            }
            if (e.x + n.x > maxX) {
                maxX = e.x + n.x;
            }
            if (e.y + n.y < minY) {
                minY = e.y + n.y;
            }
            if (e.y + n.y > maxY) {
                maxY = e.y + n.y;
            }
        }
    }

    const positions: number[] = [];

    for (let x = minX - 2; x <= maxX + 2; x++) {
        for (let y = minY - 2; y <= maxY + 2; y++) {
            if (x <= minX || x >= maxX || y <= minY || y >= maxY) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL && x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                    positions.push(packPosition(new RoomPosition(x, y, roomName)));
                }
            }
        }
    }

    // lets flood fill to remove useless ramparts
    const layout: CostMatrix = new PathFinder.CostMatrix();
    // 0 = empty
    // 1 = flood
    // 2 = rampart
    // 3 = foundRampart
    // 255 = wall

    const floodQueue: { x: number; y: number }[] = [];

    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                layout.set(x, y, 255);
                continue;
            }
            if (x === 0 || x === 49 || y === 0 || y === 49) {
                layout.set(x, y, 1);
                floodQueue.push({
                    x,
                    y
                });
            }
        }
    }

    for (const pos of positions) {
        const p = unpackPosition(pos);
        layout.set(p.x, p.y, 2);
    }

    while (floodQueue.length > 0) {
        const n = floodQueue.shift();
        if (n === undefined) {
            break;
        }
        // check for neighboring empties
        for (let mx = -1; mx <= 1; mx++) {
            for (let my = -1; my <= 1; my++) {
                const nx = n.x + mx;
                const ny = n.y + my;
                if (nx < 0 || nx > 49 || ny < 0 || ny > 49) {
                    continue;
                }
                if (layout.get(nx, ny) === 0) {
                    floodQueue.push({
                        x: nx,
                        y: ny
                    });
                    layout.set(nx, ny, 1);
                }
            }
        }
        // check for nearby ramparts
        for (let mx = -3; mx <= 3; mx++) {
            for (let my = -3; my <= 3; my++) {
                const nx = n.x + mx;
                const ny = n.y + my;
                if (nx < 0 || nx > 49 || ny < 0 || ny > 49) {
                    continue;
                }
                if (layout.get(nx, ny) === 2) {
                    layout.set(nx, ny, 3);
                }
            }
        }
    }

    // remove not-found ramparts
    const newPositions: number[] = [];

    for (const p of positions) {
        const pos = unpackPosition(p);
        const num = layout.get(pos.x, pos.y);
        if (num === 3) {
            newPositions.push(p);
        }
    }
    console.log("DDone");
    return newPositions;
}

function getPotentialBunkerCenters(roomName: string, basicLayout: BasicLayoutData): RoomPosition[] {
    const terrain: RoomTerrain = Game.map.getRoomTerrain(roomName);
    const potentialLocations: RoomPosition[] = [];
    let matrix = new PathFinder.CostMatrix();
    //255 = too close to wall
    //0 = ok
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                matrix = _pbcSetWALL(matrix, x, y);
            }
        }
    }
    const controllerPos = unpackPosition(basicLayout.controller);
    for (let dx = -8; dx <= 8; dx++) {
        for (let dy = -8; dy <= 8; dy++) {
            if (
                controllerPos.x + dx < 0 ||
                controllerPos.x + dx > 49 ||
                controllerPos.y + dy < 0 ||
                controllerPos.y + dy > 49
            ) {
                continue;
            }
            matrix.set(controllerPos.x + dx, controllerPos.y + dy, 255);
        }
    }
    for (const sourceData of basicLayout.sources) {
        const sourcePos = unpackPosition(sourceData.pos);
        for (let dx = -8; dx <= 8; dx++) {
            for (let dy = -8; dy <= 8; dy++) {
                if (sourcePos.x + dx < 0 || sourcePos.x + dx > 49 || sourcePos.y + dy < 0 || sourcePos.y + dy > 49) {
                    continue;
                }
                matrix.set(sourcePos.x + dx, sourcePos.y + dy, 255);
            }
        }
    }

    for (let x = 8; x <= 41; x++) {
        for (let y = 8; y <= 41; y++) {
            if (matrix.get(x, y) !== 255) {
                potentialLocations.push(new RoomPosition(x, y, roomName));
            }
        }
    }
    return potentialLocations;
}
function _pbcSetWALL(matrix: CostMatrix, x: number, y: number): CostMatrix {
    for (let dx = -6; dx <= 6; dx++) {
        for (let dy = -6; dy <= 6; dy++) {
            if (x + dx < 0 || x + dx > 49 || y + dy < 0 || y + dy > 49) {
                continue;
            }
            matrix.set(x + dx, y + dy, 255);
        }
    }
    return matrix;
}

function getPotentialAutoCenters(roomName: string): { pos: RoomPosition; dir: LabDirection }[] {
    const terrain: RoomTerrain = Game.map.getRoomTerrain(roomName);
    const potentialLocations: { pos: RoomPosition; dir: LabDirection }[] = [];

    const baseCenterLabBounds = getAutoCenterBounds();

    for (let x = 8; x <= 41; x++) {
        for (let y = 8; y <= 41; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                continue;
            }
            for (let dir = 0; dir < 4; dir++) {
                let close = false;
                for (const offset of baseCenterLabBounds[dir]) {
                    const pos = {
                        x: x + offset.x,
                        y: y + offset.y
                    };
                    if (
                        terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL ||
                        pos.x < 2 ||
                        pos.x > 47 ||
                        pos.y < 2 ||
                        pos.y > 47
                    ) {
                        close = true;
                        break;
                    }
                }
                if (close === false) {
                    // this pos + dir works
                    console.log("potentialAutoLocations");
                    potentialLocations.push({
                        pos: new RoomPosition(x, y, roomName),
                        dir: dir as LabDirection
                    });
                    break; // do not bother checking other directions of this position;!
                }
            }
        }
    }
    return potentialLocations;
}
function getAutoExtensionLayout(
    roomName: string,
    center: { pos: RoomPosition; dir: LabDirection },
    basicLayout: BasicLayoutData
): number[] | null {
    const terrain: RoomTerrain = Game.map.getRoomTerrain(roomName);
    const centerBounds = getAutoCenterBounds(true)[center.dir];
    const nodeBounds = getAutoExtensionNodeBounds(true);

    let layout = new PathFinder.CostMatrix();
    // 0 = free
    // 1 = neighboring obstacle
    // 255 = obstacle

    const spos: RoomPosition[] = basicLayout.sources.map((s) => unpackPosition(s.pos));
    for (let x = 0; x < 50; x++) {
        // set walls to 255 && neighbors to 1
        for (let y = 0; y < 50; y++) {
            for (const s of spos) {
                if (s.x === x && s.y === y) {
                    for (let mx = -1; mx <= 1; mx++) {
                        for (let my = -1; my <= 1; my++) {
                            layout = _extLayoutSet255(layout, x + mx, y + my);
                        }
                    }
                }
            }

            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                layout = _extLayoutSet255(layout, x, y);
            } else if (x <= 4 || x >= 45 || y <= 4 || y >= 45) {
                layout = _extLayoutSet255(layout, x, y);
            }
        }
    }
    for (const pos of centerBounds) {
        // set centerbounds to 255 && neighbors to 1
        layout = _extLayoutSet255(layout, center.pos.x + pos.x, center.pos.y + pos.y);
        Game.rooms[roomName].visual.circle(center.pos.x + pos.x, center.pos.y + pos.y, { fill: "#ffff00" });
    }

    for (let x = 0; x < 50; x++) {
        // set walls to 255 && neighbors to 1
        for (let y = 0; y < 50; y++) {
            const r = layout.get(x, y);
            // Game.rooms[roomName].visual.text(r.toString(),x,y,{font:0.5,});
        }
    }

    // to find extension locations
    // find closest location with 0 value
    // pick it and make it 255 + neighbors(node bounds(no roads))
    // repeat until 12 are found
    const extensionNodes: number[] = [];
    let repeat = 50;
    while (extensionNodes.length < 12) {
        let x: number = -1;
        let y: number = -1;
        let width: number = 1;
        while (x === -1) {
            // console.log("in while loop + " + width);
            for (let sx = -width; sx <= width; sx++) {
                for (let sy = -width; sy <= width; sy++) {
                    if (Math.abs(sx) + Math.abs(sy) === width) {
                        // lets search here

                        if (
                            center.pos.x + sx > 0 &&
                            center.pos.x + sx < 49 &&
                            center.pos.y + sy > 0 &&
                            center.pos.y + sy < 49 &&
                            layout.get(center.pos.x + sx, center.pos.y + sy) === 0
                        ) {
                            // found a spot
                            x = center.pos.x + sx;
                            y = center.pos.y + sy;
                            // console.log("found a spot " + x + "|"+ y);
                            // console.log(center.pos.x + " " + center.pos.y);
                            for (const node of nodeBounds) {
                                layout = _extLayoutSet255(layout, x + node.x, y + node.y);
                            }
                        }
                    }
                }
                if (x !== -1) {
                    break;
                }
            }
            width++;
            if (width > 30) {
                // console.log("width 24");
                break;
            }
        }

        if (repeat === 0 || width > 30) {
            // console.log("stuck searching for extensionNodes");
            return null;
        }

        // console.log("extensionNodes " + x + "-"+ y);
        Game.rooms[roomName].visual.circle(x, y);
        extensionNodes.push(packPosition(new RoomPosition(x, y, roomName)));
        repeat--;
    }

    return extensionNodes;
}
function _extLayoutSet255(layout: CostMatrix, x: number, y: number): CostMatrix {
    layout.set(x, y, 255);
    for (let mx = -2; mx <= 2; mx++) {
        for (let my = -2; my <= 2; my++) {
            if (layout.get(x + mx, y + my) !== 255 && Math.abs(mx) + Math.abs(my) < 3) {
                layout.set(x + mx, y + my, 1);
            }
        }
    }
    return layout;
}

let _autoCenterLabBounds: { x: number; y: number }[][];
let _autoCenterLabBoundsNoRoads: { x: number; y: number }[][];

function getAutoCenterBounds(noRoads: boolean = false): { x: number; y: number }[][] {
    if (noRoads && _autoCenterLabBoundsNoRoads !== undefined) {
        return _autoCenterLabBoundsNoRoads;
    }
    if (_autoCenterLabBounds !== undefined) {
        return _autoCenterLabBounds;
    }
    const tBaseCenterLabBounds: { x: number; y: number }[][] = [[], [], [], []];
    for (let i = 0; i <= 8; i++) {
        for (const baseCenter of baseCenterLayout[i]) {
            if (noRoads && baseCenter.type === STRUCTURE_ROAD) {
                continue;
            }
            const o = {
                x: baseCenter.x,
                y: baseCenter.y
            };
            tBaseCenterLabBounds[0].push(o);
            tBaseCenterLabBounds[1].push(o);
            tBaseCenterLabBounds[2].push(o);
            tBaseCenterLabBounds[3].push(o);
        }
    }
    for (let dir = 0; dir < 4; dir++) {
        for (let i = 0; i <= 8; i++) {
            for (const autoLab of autoLabsLayout[i]) {
                if (noRoads && autoLab.type === STRUCTURE_ROAD) {
                    continue;
                }
                const o: { x: number; y: number } = {
                    x: (autoLab.x * autoLabsRotationGuide[dir].mx) as number,
                    y: (autoLab.y * autoLabsRotationGuide[dir].my) as number
                };
                tBaseCenterLabBounds[dir].push(o);
            }
        }
    }

    const baseCenterLabBounds: { x: number; y: number }[][] = [[], [], [], []];
    for (let dir = 0; dir < 4; dir++) {
        for (const tBaseCenter of tBaseCenterLabBounds[dir]) {
            if (
                !baseCenterLabBounds[dir].some((s) => s !== undefined && s.x === tBaseCenter.x && s.y === tBaseCenter.y)
            ) {
                // is a unique;
                baseCenterLabBounds[dir].push(tBaseCenter);
            }
        }
    }

    if (noRoads) {
        _autoCenterLabBoundsNoRoads = baseCenterLabBounds;
    } else {
        _autoCenterLabBounds = baseCenterLabBounds;
    }
    return baseCenterLabBounds;
}

let _autoExtensionNodeBounds: { x: number; y: number }[];
let _autoExtensionNodeBoundsNoRoads: { x: number; y: number }[];

function getAutoExtensionNodeBounds(noRoads: boolean = false): { x: number; y: number }[] {
    if (noRoads && _autoExtensionNodeBoundsNoRoads !== undefined) {
        return _autoExtensionNodeBoundsNoRoads;
    }
    if (_autoExtensionNodeBounds !== undefined) {
        return _autoExtensionNodeBounds;
    }
    const tBaseCenterLabBounds: { x: number; y: number }[] = [];

    for (const autoExtension of autoExtensionNode) {
        if (noRoads && autoExtension.type === STRUCTURE_ROAD) {
            continue;
        }
        const o = {
            x: autoExtension.x,
            y: autoExtension.y
        };
        tBaseCenterLabBounds.push(o);
    }

    const baseCenterLabBounds: { x: number; y: number }[] = [];

    for (const e of tBaseCenterLabBounds) {
        if (!baseCenterLabBounds.some((s) => s.x === e.x && s.y === e.y)) {
            // is a unique;
            baseCenterLabBounds.push(e);
        }
    }

    if (noRoads) {
        _autoExtensionNodeBoundsNoRoads = baseCenterLabBounds;
    } else {
        _autoExtensionNodeBounds = baseCenterLabBounds;
    }
    return baseCenterLabBounds;
}

function getControllerStore(basicLayout: BasicLayoutData, centerLocation: RoomPosition): RoomPosition | null {
    const goal: { pos: RoomPosition; range: number } = {
        pos: unpackPosition(basicLayout.controller),
        range: 1
    };

    const search: PathFinderPath = PathFinder.search(centerLocation, goal, {
        swampCost: 1,
        plainCost: 1
    });
    const path: RoomPosition[] = search.path;

    return path[path.length - 2];
}

function getSources(basicLayout: BasicLayoutData, centerLocation: RoomPosition): SourceData[] | null {
    const terrain = Game.map.getRoomTerrain(centerLocation.roomName);
    if (basicLayout.sources.length === 0) {
        console.log("getSources no sources");
        return null;
    }

    const sources: SourceData[] = [];

    for (const bsource of basicLayout.sources) {
        const search: PathFinderPath = PathFinder.search(centerLocation, {
            pos: unpackPosition(bsource.pos),
            range: 1
        });
        const path: RoomPosition[] = search.path;

        const containerPos = path[path.length - 1];
        const roadDir = containerPos.getDirectionTo(path[path.length - 2]);

        let linkDir: DirectionConstant | null = null;
        for (let i = 1; i <= 8; i++) {
            if (roadDir === i) {
                continue;
            }
            const p = offsetPositionByDirection(containerPos, i as DirectionConstant);
            if (terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL) {
                linkDir = i as DirectionConstant;
                break;
            }
        }
        if (linkDir === null) {
            console.log("linkDir === null");
            return null;
        }

        let extensionDir: DirectionConstant | null = null;
        for (let i = 1; i <= 8; i++) {
            if (roadDir === i) {
                continue;
            }
            if (linkDir === i) {
                continue;
            }
            const p = offsetPositionByDirection(containerPos, i as DirectionConstant);
            if (terrain.get(p.x, p.y) !== TERRAIN_MASK_WALL) {
                extensionDir = i as DirectionConstant;
                break;
            }
        }

        const distance = PathFinder.search(
            new RoomPosition(centerLocation.x - 1, centerLocation.y, centerLocation.roomName),
            {
                pos: containerPos,
                range: 1
            }
        ).path.length;

        sources.push({
            id: bsource.id,
            pos: bsource.pos,
            container: unpackPosition(bsource.pos).getDirectionTo(containerPos),
            dist: distance,
            extensions: extensionDir === null ? [] : [extensionDir],
            link: linkDir
        });
    }

    return sources;
}
function getMineral(basicLayout: BasicLayoutData, centerLocation: RoomPosition): MineralData | null {
    if (basicLayout.mineral === undefined) {
        return null;
    }

    const search: PathFinderPath = PathFinder.search(centerLocation, {
        pos: unpackPosition(basicLayout.mineral.pos),
        range: 1
    });
    const path: RoomPosition[] = search.path;

    const containerPos = path[path.length - 1];

    const distance = PathFinder.search(
        new RoomPosition(centerLocation.x, centerLocation.y + 2, centerLocation.roomName),
        {
            pos: containerPos,
            range: 1
        }
    ).path.length;

    return {
        id: basicLayout.mineral.id,
        pos: basicLayout.mineral.pos,
        container: unpackPosition(basicLayout.mineral.pos).getDirectionTo(containerPos),
        dist: distance
    };
}

function getRoads(
    centerLocation: RoomPosition,
    baseType: BaseType,
    controllerStore: RoomPosition,
    sources: SourceData[],
    mineral: MineralData
): RoadData[] | null {
    const roads: RoadData[] = [];

    const roadCostMatrix = (roomName: string): boolean | CostMatrix => {
        const room = Game.rooms[roomName];

        if (roomName !== centerLocation.roomName) {
            if (Memory.rooms[centerLocation.roomName].remotes === undefined) {
                return false;
            }
            let isRemote = false;
            for (const r of Memory.rooms[centerLocation.roomName].remotes) {
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

        for (const roadData of roads) {
            for (const road of roadData.positions) {
                const pos = unpackPosition(road);
                if (pos.roomName === roomName) {
                    costs.set(pos.x, pos.y, 1);
                }
            }
        }

        if (room !== undefined) {
            room.find(FIND_STRUCTURES).forEach((struct) => {
                if (
                    struct.structureType !== STRUCTURE_CONTAINER &&
                    (struct.structureType !== STRUCTURE_RAMPART || !struct.my) &&
                    struct.structureType !== STRUCTURE_ROAD
                ) {
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
                if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                }
            });
            room.find(FIND_MY_CONSTRUCTION_SITES).forEach((struct) => {
                if (
                    struct.structureType !== STRUCTURE_CONTAINER &&
                    (struct.structureType !== STRUCTURE_RAMPART || !struct.my) &&
                    struct.structureType !== STRUCTURE_ROAD
                ) {
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
                if (struct.structureType === STRUCTURE_ROAD) {
                    costs.set(struct.pos.x, struct.pos.y, 1);
                }
            });
            if (room.name === centerLocation.roomName) {
                if (baseType === "bunker") {
                    for (let x = -6; x <= 6; x++) {
                        for (let y = -6; y <= 6; y++) {
                            if (
                                y === 0 ||
                                x === 6 ||
                                x === -6 ||
                                y === 6 ||
                                y === -6 ||
                                (x === 0 && Math.abs(y) <= 3) ||
                                (Math.abs(x) === 1 && Math.abs(y) === 4) ||
                                (Math.abs(x) === 2 && Math.abs(y) === 5)
                            ) {
                                costs.set(x, y, 1);
                            } else {
                                costs.set(x, y, 0xff);
                            }
                        }
                    }
                }
                for (const s of sources) {
                    const containerPos = offsetPositionByDirection(unpackPosition(s.pos), s.container);
                    const linkPos = offsetPositionByDirection(containerPos, s.link);
                    if (baseType === "auto") {
                        const extensionPos = offsetPositionByDirection(containerPos, s.extensions[0]);
                        costs.set(extensionPos.x, extensionPos.y, 0xff);
                    }

                    costs.set(containerPos.x, containerPos.y, 0xff);
                    costs.set(linkPos.x, linkPos.y, 0xff);
                }
                const mineralPos = offsetPositionByDirection(unpackPosition(mineral.pos), mineral.container);
                costs.set(mineralPos.x, mineralPos.y, 0xff);
            }
        }
        if (Memory.rooms[roomName] !== undefined) {
            if (Memory.rooms[roomName].remoteLayout !== undefined) {
                for (const s of Memory.rooms[roomName].remoteLayout.sources) {
                    const p = offsetPositionByDirection(unpackPosition(s.pos), s.container);
                    costs.set(p.x, p.y, 0xff);
                }
            }
        }
        return costs;
    };

    const controllerPath: RoomPosition[] = PathFinder.search(
        centerLocation,
        {
            pos: controllerStore,
            range: 1
        },
        {
            maxOps: 5000,
            plainCost: 3,
            swampCost: 3,
            roomCallback: roadCostMatrix
        }
    ).path;

    roads.push({
        positions: _.compact(
            controllerPath.map((pos) => {
                if (pos.roomName === centerLocation.roomName) {
                    if (
                        baseType === "bunker"
                            ? pos.getRangeTo(centerLocation) <= 6
                            : Math.abs(pos.x - centerLocation.x) + Math.abs(pos.y - centerLocation.y) < 3
                    ) {
                        return 0;
                    }
                    return packPosition(pos);
                } else {
                    return packPosition(pos);
                }
            })
        )
    });

    const mineralPath: RoomPosition[] = PathFinder.search(
        centerLocation,
        {
            pos: offsetPositionByDirection(unpackPosition(mineral.pos), mineral.container),
            range: 1
        },
        {
            maxOps: 5000,
            plainCost: 3,
            swampCost: 3,
            roomCallback: roadCostMatrix
        }
    ).path;

    roads.push({
        positions: _.compact(
            mineralPath.map((pos) => {
                if (pos.roomName === centerLocation.roomName) {
                    if (
                        baseType === "bunker"
                            ? pos.getRangeTo(centerLocation) <= 6
                            : Math.abs(pos.x - centerLocation.x) + Math.abs(pos.y - centerLocation.y) < 3
                    ) {
                        return 0;
                    }
                    return packPosition(pos);
                } else {
                    return packPosition(pos);
                }
            })
        )
    });

    for (const sourceData of sources) {
        const sourcePath: RoomPosition[] = PathFinder.search(
            centerLocation,
            {
                pos: offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container),
                range: 1
            },
            {
                maxOps: 5000,
                plainCost: 3,
                swampCost: 3,
                roomCallback: roadCostMatrix
            }
        ).path;

        roads.push({
            positions: _.compact(
                sourcePath.map((pos) => {
                    if (pos.roomName === centerLocation.roomName) {
                        if (
                            baseType === "bunker"
                                ? pos.getRangeTo(centerLocation) <= 6
                                : Math.abs(pos.x - centerLocation.x) + Math.abs(pos.y - centerLocation.y) < 3
                        ) {
                            return 0;
                        }
                        return packPosition(pos);
                    } else {
                        return packPosition(pos);
                    }
                })
            )
        });
    }

    if (Memory.rooms[centerLocation.roomName].remotes.length > 0) {
        for (const remote of Memory.rooms[centerLocation.roomName].remotes) {
            if (Memory.rooms[remote] === undefined) {
                continue;
            }
            for (const rd of Memory.rooms[remote].remoteLayout.sources) {
                //console.log("finding remote roads");
                const sourcePath: RoomPosition[] = PathFinder.search(
                    centerLocation,
                    {
                        pos: offsetPositionByDirection(unpackPosition(rd.pos), rd.container),
                        range: 1
                    },
                    {
                        maxOps: 5000,
                        plainCost: 3,
                        swampCost: 3,
                        roomCallback: roadCostMatrix
                    }
                ).path;
                roads.push({
                    positions: _.compact(
                        sourcePath.map((pos) => {
                            if (pos.roomName === centerLocation.roomName) {
                                if (
                                    baseType === "bunker"
                                        ? pos.getRangeTo(centerLocation) <= 6
                                        : Math.abs(pos.x - centerLocation.x) + Math.abs(pos.y - centerLocation.y) < 3
                                ) {
                                    return 0;
                                }
                                return packPosition(pos);
                            } else {
                                return packPosition(pos);
                            }
                        })
                    )
                });
            }
        }
    }
    return roads;
}

function getRemoteLayout(orgRoomName: string, roomName: string, centerLocation: RoomPosition): RemoteLayoutData | null {
    if (Memory.rooms[roomName] === undefined) {
        return null;
    }

    const basicLayout: BasicLayoutData = Memory.rooms[roomName].basicLayout;
    if (basicLayout === undefined) {
        if (Game.rooms[roomName] !== undefined) {
            Memory.rooms[roomName].basicLayout = getBasicLayout(Game.rooms[roomName]);
        } else {
            return null;
        }
    }
    const sources: RemoteSourceData[] = [];
    for (const sourceData of basicLayout.sources) {
        const search: PathFinderPath = PathFinder.search(
            centerLocation,
            {
                pos: unpackPosition(sourceData.pos),
                range: 1
            },
            {
                maxOps: 20000
            }
        );
        const path: RoomPosition[] = search.path;

        const containerPos = path[path.length - 1];

        const distance = PathFinder.search(
            new RoomPosition(centerLocation.x - 1, centerLocation.y, centerLocation.roomName),
            {
                pos: containerPos,
                range: 1
            },
            {
                maxOps: 20000
            }
        ).path.length;

        const tdist = distance * 2;
        const capacityNeeded = (SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME) * tdist;
        const carryNeeded = capacityNeeded / 50;
        const maxCarry = Math.min(Math.floor(Game.rooms[orgRoomName].energyCapacityAvailable / 75), 33);

        const creepsNeeded = Math.ceil(carryNeeded / maxCarry);
        const patternValue = Math.ceil(carryNeeded / creepsNeeded / 2) + 1;

        sources.push({
            id: sourceData.id,
            pos: sourceData.pos,
            container: unpackPosition(sourceData.pos).getDirectionTo(containerPos),
            dist: distance,
            haulers: {
                amountNeeded: creepsNeeded,
                pattern: "[mcc]" + patternValue
            }
        });
    }
    return {
        sources
    };
}

function buildLayout(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }

    const baseType: BaseType = room.memory.layout.baseType;

    room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_WALL
    }).forEach((s) => s.destroy());

    buildRoads(room);

    buildBaseCenter(room);

    if (baseType === "bunker") {
        buildBunker(room);
    } else if (baseType === "auto") {
        buildAuto(room);
    }

    buildContainers(room);

    if (room.controller.level >= 5) {
        const cspos = unpackPosition(room.memory.layout.controllerStore);
        smartBuild(cspos, STRUCTURE_LINK);
        smartBuild(cspos, STRUCTURE_RAMPART);

        for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
            const pos: RoomPosition = offsetPositionByDirection(room.controller.pos, dir as DirectionConstant);
            smartBuild(pos, STRUCTURE_RAMPART);
        }
    }
    if (room.controller.level >= 6) {
        smartBuild(unpackPosition(room.memory.layout.mineral.pos), STRUCTURE_EXTRACTOR);
        const mpos = offsetPositionByDirection(
            unpackPosition(room.memory.layout.sources[0].pos),
            room.memory.layout.sources[0].container
        );
        const lpos = offsetPositionByDirection(mpos, room.memory.layout.sources[0].link);

        smartBuild(lpos, STRUCTURE_LINK);
        smartBuild(lpos, STRUCTURE_RAMPART);
        smartBuild(mpos, STRUCTURE_RAMPART);
    }
    if (room.controller.level >= 7 && room.memory.layout.sources.length >= 2) {
        const mpos = offsetPositionByDirection(
            unpackPosition(room.memory.layout.sources[1].pos),
            room.memory.layout.sources[1].container
        );
        const lpos = offsetPositionByDirection(mpos, room.memory.layout.sources[1].link);

        smartBuild(lpos, STRUCTURE_LINK);
        smartBuild(lpos, STRUCTURE_RAMPART);
        smartBuild(mpos, STRUCTURE_RAMPART);
    }

    executeSmartBuild(room);
}

function buildBaseCenter(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }
    const bpos = unpackPosition(room.memory.layout.baseCenter);
    followBuildInstructions(room, bpos, baseCenterLayout);
}
function buildBunker(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }
    const bpos = unpackPosition(room.memory.layout.baseCenter);
    followBuildInstructions(room, bpos, bunkerLayout);
}
function buildAuto(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }
    const bpos = unpackPosition(room.memory.layout.baseCenter);
    const layout: AutoLayoutData = room.memory.layout as AutoLayoutData;
    // build labs
    followBuildInstructions(room, bpos, autoLabsLayout, autoLabsRotationGuide, layout.labDirection);

    // build extensions
    for (
        let index = 0;
        index < Math.min(autoExtensionNodeCount[room.controller.level], layout.extensions.length);
        index++
    ) {
        const pos: RoomPosition = unpackPosition(layout.extensions[index]);
        followBuildInstructions(room, pos, index <= 1 ? [autoExtensionSpawnNode] : [autoExtensionNode]);

        if (index <= 1) {
            if (layout.sources[index].extensions.length > 0) {
                for (const i of layout.sources[index].extensions) {
                    const epos = offsetPositionByDirection(
                        offsetPositionByDirection(
                            unpackPosition(layout.sources[index].pos),
                            layout.sources[index].container
                        ),
                        i
                    );
                    smartBuild(epos, STRUCTURE_EXTENSION);
                }
            }
        }
    }

    // build ramparts
    if (room.controller.level >= 3) {
        for (const pos of layout.ramparts) {
            const p = unpackPosition(pos);
            smartBuild(p, STRUCTURE_RAMPART);
        }
    }
}
function followBuildInstructions(
    room: Room,
    cpos: RoomPosition,
    bis: BuildInstruction[][],
    rotationGuide?: { mx: number; my: number }[],
    direction?: LabDirection
) {
    if (room.controller === undefined) {
        return;
    }
    for (let i = 0; i <= Math.min(room.controller.level, bis.length - 1); i++) {
        for (const element of bis[i]) {
            let x: number = element.x;
            let y: number = element.y;
            if (rotationGuide !== undefined && direction !== undefined) {
                x = element.x * rotationGuide[direction].mx;
                y = element.y * rotationGuide[direction].my;
            }

            followBuildInstruction(room, cpos, {
                x,
                y,
                type: element.type,
                name: element.name
            });
        }
    }
}
function followBuildInstruction(room: Room, cpos: RoomPosition, bi: BuildInstruction) {
    if (bi.type === STRUCTURE_SPAWN && bi.name !== undefined) {
        let name = bi.name || "";
        name = name.replace("{ROOM_NAME}", room.name);

        let i = 1;
        const done: boolean = false;
        while (!done) {
            const potentialName = name.replace("{INDEX}", i.toString());

            const res = room.createConstructionSite(cpos.x + bi.x, cpos.y + bi.y, bi.type, potentialName);
            if (res === OK) {
                return;
            }
            i++;
            if (i > 5) {
                break;
            }
        }
    } else {
        smartBuild(new RoomPosition(cpos.x + bi.x, cpos.y + bi.y, room.name), bi.type);
    }
}
function buildRoads(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }
    for (const i in room.memory.layout.roads) {
        if (i === "1" && room.controller.level < 6) {
            continue;
        }
        const element = room.memory.layout.roads[i];
        for (const pos of element.positions) {
            const p = unpackPosition(pos);
            const r = Game.rooms[p.roomName];
            if (r !== undefined) {
                smartBuild(p, STRUCTURE_ROAD);
            }
        }
    }
}
function buildContainers(room: Room) {
    if (room.memory.layout === undefined) {
        return;
    }
    if (room.controller === undefined) {
        return;
    }
    if (room.controller.level >= 1 && room.controller.level <= 4) {
        smartBuild(unpackPosition(room.memory.layout.controllerStore), STRUCTURE_CONTAINER);
    } else {
        const c: Structure = unpackPosition(room.memory.layout.controllerStore)
            .lookFor(LOOK_STRUCTURES)
            .filter((s) => s.structureType === STRUCTURE_CONTAINER)[0];
        if (c !== undefined) {
            c.destroy();
        }
    }
    for (const s in room.memory.layout.sources) {
        const source: SourceData = room.memory.layout.sources[s];
        smartBuild(offsetPositionByDirection(unpackPosition(source.pos), source.container), STRUCTURE_CONTAINER);
    }
    if (room.controller.level >= 6) {
        smartBuild(
            offsetPositionByDirection(
                unpackPosition(room.memory.layout.mineral.pos),
                room.memory.layout.mineral.container
            ),
            STRUCTURE_CONTAINER
        );
    }
}

let smartBuildData: { type: BuildableStructureConstant; pos: RoomPosition }[] = [];
function smartBuild(pos: RoomPosition, type: BuildableStructureConstant) {
    smartBuildData.push({
        pos,
        type
    });
}

function executeSmartBuild(room: Room) {
    let amtOfRampart = 0;
    let amtOfRoad = 0;

    const buildRoads: boolean =
        room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length >= 5;

    for (const site of smartBuildData) {
        const room: Room = Game.rooms[site.pos.roomName];
        if (site.type === STRUCTURE_RAMPART) {
            if (amtOfRampart >= 4 || (room.memory.repair !== undefined && Object.keys(room.memory.repair).length > 0)) {
                continue;
            }

            if (
                site.pos
                    .lookFor(LOOK_CONSTRUCTION_SITES)
                    .filter((s: ConstructionSite) => s.structureType === STRUCTURE_RAMPART).length > 0
            ) {
                amtOfRampart++;
                continue;
            }

            const res = room.createConstructionSite(site.pos, site.type);
            if (res === OK) {
                amtOfRampart++;
            }
        } else if (site.type === STRUCTURE_ROAD) {
            if (amtOfRoad >= 10 || !buildRoads) {
                continue;
            }
            if (
                site.pos
                    .lookFor(LOOK_CONSTRUCTION_SITES)
                    .filter((s: ConstructionSite) => s.structureType === STRUCTURE_ROAD).length > 0
            ) {
                amtOfRoad++;
                continue;
            }

            const res = room.createConstructionSite(site.pos, site.type);
            if (res === OK) {
                amtOfRoad++;
            }
        } else {
            room.createConstructionSite(site.pos, site.type);
        }
    }

    smartBuildData = [];
}

//
// NEW LAYOUT BUILD SYSTEM
//

declare global {
    interface RoomMemory {
        buildings?: BuildingsData;
    }
}

export interface BuildingsData {
    roads: BuildingData<STRUCTURE_ROAD>[][];
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
}

export function LayoutHandler(room: Room, speed: number): void {
    if (room.memory.roomLevel === 2) {
        //buildLayout(room);
        _BuildBuildings(room);

        if (room.memory.layout === undefined) {
            RunNow(rebuildLayout, "layouthandlergetlayout" + room.name, room);
        }

        RunEvery(rebuildLayout, "layouthandlergetlayout" + room.name, 500 / speed, room);

        if (room.memory.buildings === undefined) {
            RunNow(_GenerateBuildings, "layouthandlergeneratebuildings" + room.name, room);
            RunNow(_UpdateBuildings, "layouthandlerupdatebuildings" + room.name, room);
        }

        RunEvery(_GenerateBuildings, "layouthandlergeneratebuildings" + room.name, 500 / speed, room);
        RunEvery(_UpdateBuildings, "layouthandlerupdatebuildings" + room.name, 500 / speed, room);
    }
    if (room.memory.basicLayout === undefined) {
        room.memory.basicLayout = getBasicLayout(room);
    }
}

// GenerateBuildings(room)
// Creates buildings memory structure based on layout

function _GenerateBuildings(room: Room) {
    if (room.memory.layout === undefined || room.controller === undefined) {
        return;
    }

    // ROADS

    let roadAmt = 2 + room.memory.layout.sources.length;
    for (const remote of room.memory.remotes) {
        if (Memory.rooms[remote] !== undefined) {
            roadAmt += Memory.rooms[remote].remoteLayout.sources.length;
        }
    }

    const roads: BuildingData<STRUCTURE_ROAD>[][] = [];
    for (let i = 0; i <= roadAmt; i++) {
        roads[i] = [];
        if (room.memory.buildings !== undefined && room.memory.buildings.roads[i] !== undefined) {
            roads[i] = room.memory.buildings.roads[i];
        } else {
            if (i > 0) {
                for (const element of room.memory.layout.roads[i - 1].positions) {
                    roads[i].push({
                        pos: element,
                        active: false
                    });
                }
            }
        }
        //room.memory.layout.roads[0].po
    }

    // RAMPARTS

    let ramparts: BuildingData<STRUCTURE_RAMPART>[] = [];
    if (room.memory.buildings !== undefined) {
        ramparts = room.memory.buildings.ramparts;
    } else {
        ramparts.push({
            pos: room.memory.layout.controllerStore,
            active: false
        });

        ramparts.push({
            pos: packPosition(
                offsetPositionByDirection(
                    unpackPosition(room.memory.layout.sources[0].pos),
                    room.memory.layout.sources[0].container
                )
            ),
            active: false
        });
        ramparts.push({
            pos: packPosition(
                offsetPositionByDirection(
                    offsetPositionByDirection(
                        unpackPosition(room.memory.layout.sources[0].pos),
                        room.memory.layout.sources[0].container
                    ),
                    room.memory.layout.sources[0].link
                )
            ),
            active: false
        });

        if (room.memory.layout.sources.length > 1) {
            ramparts.push({
                pos: packPosition(
                    offsetPositionByDirection(
                        unpackPosition(room.memory.layout.sources[1].pos),
                        room.memory.layout.sources[1].container
                    )
                ),
                active: false
            });
            ramparts.push({
                pos: packPosition(
                    offsetPositionByDirection(
                        offsetPositionByDirection(
                            unpackPosition(room.memory.layout.sources[1].pos),
                            room.memory.layout.sources[1].container
                        ),
                        room.memory.layout.sources[1].link
                    )
                ),
                active: false
            });
        }

        const terrain: RoomTerrain = room.getTerrain();
        for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
            const pos: RoomPosition = offsetPositionByDirection(room.controller.pos, dir as DirectionConstant);
            if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                ramparts.push({
                    pos: packPosition(pos),
                    active: false
                });
            }
        }
    }

    // CONTAINERS

    let containers: BuildingData<STRUCTURE_CONTAINER>[] = [];
    if (room.memory.buildings !== undefined) {
        containers = room.memory.buildings.containers;
    } else {
        containers.push({
            pos: room.memory.layout.controllerStore,
            active: false
        });
        containers.push({
            pos: packPosition(
                offsetPositionByDirection(
                    unpackPosition(room.memory.layout.mineral.pos),
                    room.memory.layout.mineral.container
                )
            ),
            active: false
        });
        containers.push({
            pos: packPosition(
                offsetPositionByDirection(
                    unpackPosition(room.memory.layout.sources[0].pos),
                    room.memory.layout.sources[0].container
                )
            ),
            active: true
        });
        if (room.memory.layout.sources.length > 1) {
            containers.push({
                pos: packPosition(
                    offsetPositionByDirection(
                        unpackPosition(room.memory.layout.sources[1].pos),
                        room.memory.layout.sources[1].container
                    )
                ),
                active: true
            });
        }
    }

    // LINKS

    let links: BuildingData<STRUCTURE_LINK>[] = [];
    if (room.memory.buildings !== undefined) {
        links = room.memory.buildings.links;
    } else {
        links.push({
            pos: room.memory.layout.controllerStore,
            active: false
        });
        links.push({
            pos: packPosition(
                offsetPositionByDirection(
                    offsetPositionByDirection(
                        unpackPosition(room.memory.layout.sources[0].pos),
                        room.memory.layout.sources[0].container
                    ),
                    room.memory.layout.sources[0].link
                )
            ),
            active: false
        });
        if (room.memory.layout.sources.length > 1) {
            links.push({
                pos: packPosition(
                    offsetPositionByDirection(
                        offsetPositionByDirection(
                            unpackPosition(room.memory.layout.sources[1].pos),
                            room.memory.layout.sources[1].container
                        ),
                        room.memory.layout.sources[1].link
                    )
                ),
                active: false
            });
        }
    }

    // EXTRACTOR

    let extractor: BuildingData<STRUCTURE_EXTRACTOR>;
    if (room.memory.buildings !== undefined) {
        extractor = room.memory.buildings.extractor;
    } else {
        extractor = {
            pos: room.memory.layout.mineral.pos,
            active: false
        };
    }

    let extensions: BuildingData<STRUCTURE_EXTENSION>[] = [];
    let labs: BuildingData<STRUCTURE_LAB>[] = [];
    let spawns: BuildingData<STRUCTURE_SPAWN>[] = [];
    let towers: BuildingData<STRUCTURE_TOWER>[] = [];
    let storage: BuildingData<STRUCTURE_STORAGE> | undefined;
    let terminal: BuildingData<STRUCTURE_TERMINAL> | undefined;
    let factory: BuildingData<STRUCTURE_FACTORY> | undefined;
    let powerspawn: BuildingData<STRUCTURE_POWER_SPAWN> | undefined;
    let nuker: BuildingData<STRUCTURE_NUKER> | undefined;
    let observer: BuildingData<STRUCTURE_OBSERVER> | undefined;
    if (room.memory.buildings !== undefined) {
        roads[0] = room.memory.buildings.roads[0];
        extensions = room.memory.buildings.extensions;
        labs = room.memory.buildings.labs;
        spawns = room.memory.buildings.spawns;
        towers = room.memory.buildings.towers;
        storage = room.memory.buildings.storage;
        terminal = room.memory.buildings.terminal;
        factory = room.memory.buildings.factory;
        powerspawn = room.memory.buildings.powerspawn;
        nuker = room.memory.buildings.nuker;
        observer = room.memory.buildings.observer;
    } else {
        const centerPos: RoomPosition = unpackPosition(room.memory.layout.baseCenter);

        // BASE CENTER

        for (let x = 0; x < baseCenterLayout.length; x++) {
            for (const element of baseCenterLayout[x]) {
                switch (element.type) {
                    case STRUCTURE_ROAD:
                        const posroad: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        roads[0].push({
                            pos: packPosition(posroad),
                            active: false
                        });
                        break;
                    case STRUCTURE_RAMPART:
                        const posrampart: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        ramparts.push({
                            pos: packPosition(posrampart),
                            active: false
                        });
                        break;
                    case STRUCTURE_EXTENSION:
                        const posextension: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        extensions.push({
                            pos: packPosition(posextension),
                            active: false
                        });
                        break;
                    case STRUCTURE_LAB:
                        const poslab: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        labs.push({
                            pos: packPosition(poslab),
                            active: false
                        });
                        break;
                    case STRUCTURE_LINK:
                        const poslink: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        links.push({
                            pos: packPosition(poslink),
                            active: false
                        });
                        break;
                    case STRUCTURE_SPAWN:
                        const posspawn: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        spawns.push({
                            name: "{ROOM_NAME}-{INDEX}",
                            pos: packPosition(posspawn),
                            active: false
                        });
                        break;
                    case STRUCTURE_CONTAINER:
                        const poscontainer: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        containers.push({
                            pos: packPosition(poscontainer),
                            active: false
                        });
                        break;
                    case STRUCTURE_TOWER:
                        const postower: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        towers.push({
                            pos: packPosition(postower),
                            active: false
                        });
                        break;
                    case STRUCTURE_STORAGE:
                        const posstorage: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        storage = {
                            pos: packPosition(posstorage),
                            active: false
                        };
                        break;
                    case STRUCTURE_TERMINAL:
                        const posterminal: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        terminal = {
                            pos: packPosition(posterminal),
                            active: false
                        };
                        break;
                    case STRUCTURE_FACTORY:
                        const posfactory: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        factory = {
                            pos: packPosition(posfactory),
                            active: false
                        };
                        break;
                    case STRUCTURE_POWER_SPAWN:
                        const pospowerspawn: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        powerspawn = {
                            pos: packPosition(pospowerspawn),
                            active: false
                        };
                        break;
                    case STRUCTURE_NUKER:
                        const posnuker: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        nuker = {
                            pos: packPosition(posnuker),
                            active: false
                        };
                        break;
                    case STRUCTURE_OBSERVER:
                        const posobserver: RoomPosition = new RoomPosition(
                            centerPos.x + element.x,
                            centerPos.y + element.y,
                            centerPos.roomName
                        );
                        observer = {
                            pos: packPosition(posobserver),
                            active: false
                        };
                        break;
                    default:
                        console.log("non handled structure : " + element.type);
                        break;
                }
            }
        }

        // BUNKER / AUTO

        if (room.memory.layout.baseType === "bunker") {
            for (let x = 0; x < bunkerLayout.length; x++) {
                for (const element of bunkerLayout[x]) {
                    switch (element.type) {
                        case STRUCTURE_ROAD:
                            const posroad: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            roads[0].push({
                                pos: packPosition(posroad),
                                active: false
                            });
                            break;
                        case STRUCTURE_RAMPART:
                            const posrampart: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            ramparts.push({
                                pos: packPosition(posrampart),
                                active: false
                            });
                            break;
                        case STRUCTURE_EXTENSION:
                            const posextension: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            extensions.push({
                                pos: packPosition(posextension),
                                active: false
                            });
                            break;
                        case STRUCTURE_LAB:
                            const poslab: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            labs.push({
                                pos: packPosition(poslab),
                                active: false
                            });
                            break;
                        case STRUCTURE_LINK:
                            const poslink: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            links.push({
                                pos: packPosition(poslink),
                                active: false
                            });
                            break;
                        case STRUCTURE_SPAWN:
                            const posspawn: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            spawns.push({
                                name: "{ROOM_NAME}-{INDEX}",
                                pos: packPosition(posspawn),
                                active: false
                            });
                            break;
                        case STRUCTURE_CONTAINER:
                            const poscontainer: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            containers.push({
                                pos: packPosition(poscontainer),
                                active: false
                            });
                            break;
                        case STRUCTURE_TOWER:
                            const postower: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            towers.push({
                                pos: packPosition(postower),
                                active: false
                            });
                            break;
                        case STRUCTURE_STORAGE:
                            const posstorage: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            storage = {
                                pos: packPosition(posstorage),
                                active: false
                            };
                            break;
                        case STRUCTURE_TERMINAL:
                            const posterminal: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            terminal = {
                                pos: packPosition(posterminal),
                                active: false
                            };
                            break;
                        case STRUCTURE_FACTORY:
                            const posfactory: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            factory = {
                                pos: packPosition(posfactory),
                                active: false
                            };
                            break;
                        case STRUCTURE_POWER_SPAWN:
                            const pospowerspawn: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            powerspawn = {
                                pos: packPosition(pospowerspawn),
                                active: false
                            };
                            break;
                        case STRUCTURE_NUKER:
                            const posnuker: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            nuker = {
                                pos: packPosition(posnuker),
                                active: false
                            };
                            break;
                        case STRUCTURE_OBSERVER:
                            const posobserver: RoomPosition = new RoomPosition(
                                centerPos.x + element.x,
                                centerPos.y + element.y,
                                centerPos.roomName
                            );
                            observer = {
                                pos: packPosition(posobserver),
                                active: false
                            };
                            break;
                        default:
                            console.log("non handled structure : " + element.type);
                            break;
                    }
                }
            }
        } else if (room.memory.layout.baseType === "auto") {
            const memory = room.memory.layout as AutoLayoutData;
            const rotation = memory.labDirection;

            // LABS

            for (let i = 0; i < autoLabsLayout.length; i++) {
                for (const element of autoLabsLayout[i]) {
                    switch (element.type) {
                        case STRUCTURE_ROAD:
                            const posroad: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            roads[0].push({
                                pos: packPosition(posroad),
                                active: false
                            });
                            break;
                        case STRUCTURE_RAMPART:
                            const posrampart: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            ramparts.push({
                                pos: packPosition(posrampart),
                                active: false
                            });
                            break;
                        case STRUCTURE_EXTENSION:
                            const posextension: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            extensions.push({
                                pos: packPosition(posextension),
                                active: false
                            });
                            break;
                        case STRUCTURE_LAB:
                            const poslab: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            labs.push({
                                pos: packPosition(poslab),
                                active: false
                            });
                            break;
                        case STRUCTURE_LINK:
                            const poslink: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            links.push({
                                pos: packPosition(poslink),
                                active: false
                            });
                            break;
                        case STRUCTURE_SPAWN:
                            const posspawn: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            spawns.push({
                                pos: packPosition(posspawn),
                                active: false
                            });
                            break;
                        case STRUCTURE_CONTAINER:
                            const poscontainer: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            containers.push({
                                pos: packPosition(poscontainer),
                                active: false
                            });
                            break;
                        case STRUCTURE_TOWER:
                            const postower: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            towers.push({
                                pos: packPosition(postower),
                                active: false
                            });
                            break;
                        case STRUCTURE_STORAGE:
                            const posstorage: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            storage = {
                                pos: packPosition(posstorage),
                                active: false
                            };
                            break;
                        case STRUCTURE_TERMINAL:
                            const posterminal: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            terminal = {
                                pos: packPosition(posterminal),
                                active: false
                            };
                            break;
                        case STRUCTURE_FACTORY:
                            const posfactory: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            factory = {
                                pos: packPosition(posfactory),
                                active: false
                            };
                            break;
                        case STRUCTURE_POWER_SPAWN:
                            const pospowerspawn: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            powerspawn = {
                                pos: packPosition(pospowerspawn),
                                active: false
                            };
                            break;
                        case STRUCTURE_NUKER:
                            const posnuker: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            nuker = {
                                pos: packPosition(posnuker),
                                active: false
                            };
                            break;
                        case STRUCTURE_OBSERVER:
                            const posobserver: RoomPosition = new RoomPosition(
                                centerPos.x + element.x * autoLabsRotationGuide[rotation].mx,
                                centerPos.y + element.y * autoLabsRotationGuide[rotation].my,
                                centerPos.roomName
                            );
                            observer = {
                                pos: packPosition(posobserver),
                                active: false
                            };
                            break;
                        default:
                            console.log("non handled structure : " + element.type);
                            break;
                    }
                }
            }

            // EXTENSIONS

            for (let i = 0; i < memory.extensions.length; i++) {
                const position = unpackPosition(memory.extensions[i]);

                const node = i < 2 ? autoExtensionSpawnNode : autoExtensionNode;

                for (const element of node) {
                    switch (element.type) {
                        case STRUCTURE_ROAD:
                            const posroad: RoomPosition = new RoomPosition(
                                position.x + element.x,
                                position.y + element.y,
                                position.roomName
                            );
                            roads[0].push({
                                pos: packPosition(posroad),
                                active: false
                            });
                            break;
                        case STRUCTURE_RAMPART:
                            const posrampart: RoomPosition = new RoomPosition(
                                position.x + element.x,
                                position.y + element.y,
                                position.roomName
                            );
                            ramparts.push({
                                pos: packPosition(posrampart),
                                active: false
                            });
                            break;
                        case STRUCTURE_EXTENSION:
                            const posextension: RoomPosition = new RoomPosition(
                                position.x + element.x,
                                position.y + element.y,
                                position.roomName
                            );
                            extensions.push({
                                pos: packPosition(posextension),
                                active: false
                            });
                            break;
                        case STRUCTURE_SPAWN:
                            const posspawn: RoomPosition = new RoomPosition(
                                position.x + element.x,
                                position.y + element.y,
                                position.roomName
                            );
                            spawns.push({
                                name: "{ROOM_NAME}-{INDEX}",
                                pos: packPosition(posspawn),
                                active: false
                            });
                            break;
                        default:
                            break;
                    }
                }
            }

            // SOURCE EXTENSIONS

            for (const source of memory.sources) {
                if (source.extensions.length > 0) {
                    for (const extension of source.extensions) {
                        extensions.push({
                            pos: packPosition(
                                offsetPositionByDirection(
                                    offsetPositionByDirection(unpackPosition(source.pos), source.container),
                                    extension
                                )
                            ),
                            active: false
                        });
                    }
                }
            }

            // RAMPARTS

            for (const element of memory.ramparts) {
                ramparts.push({
                    pos: element,
                    active: false
                });
            }
        }
    }

    if (
        storage !== undefined &&
        terminal !== undefined &&
        factory !== undefined &&
        powerspawn !== undefined &&
        nuker !== undefined &&
        observer !== undefined
    ) {
        room.memory.buildings = {
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
    } else {
        console.log("error in generate buildings, undefined variables");
        console.log(
            (storage !== undefined) +
                "-" +
                (terminal !== undefined) +
                "-" +
                (factory !== undefined) +
                "-" +
                (powerspawn !== undefined) +
                "-" +
                (nuker !== undefined) +
                "-" +
                (observer !== undefined)
        );
    }
}
// UpdateBuildings(room)
// Activates and deactivates buildings

function _UpdateBuildings(room: Room) {
    if (room.memory.buildings === undefined || room.controller === undefined) {
        return;
    }

    // ROADS

    const roadsActive: boolean =
        room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_EXTENSION }).length >= 5;

    if (roadsActive) {
        for (let i = 1; i < room.memory.buildings.roads.length; i++) {
            if (i === 2 && room.controller.level < 6) {
                continue;
            }
            for (let road of room.memory.buildings.roads[i]) {
                road.active = true;
            }
        }
    }

    // CONTAINERS

    if (room.controller.level > 0 && room.controller.level < 5) {
        room.memory.buildings.containers[0].active = true;
    } else {
        room.memory.buildings.containers[0].active = false;
    }
    if (room.controller.level > 5) {
        room.memory.buildings.containers[1].active = true;
    }

    // LINKS

    if (room.controller.level > 4) {
        room.memory.buildings.links[0].active = true;
        room.memory.buildings.ramparts[0].active = true;

        const terrain: RoomTerrain = room.getTerrain();
        let i = 5;
        for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
            const pos: RoomPosition = offsetPositionByDirection(room.controller.pos, dir as DirectionConstant);
            if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                room.memory.buildings.ramparts[i].active = true;
                i++;
            }
        }
    }
    if (room.controller.level > 5) {
        room.memory.buildings.links[1].active = true;
        room.memory.buildings.ramparts[1].active = true;
        room.memory.buildings.ramparts[2].active = true;
    }
    if (room.controller.level > 6 && room.memory.layout.sources.length >= 2) {
        room.memory.buildings.links[2].active = true;
        room.memory.buildings.ramparts[3].active = true;
        room.memory.buildings.ramparts[4].active = true;
    }

    // EXTRACTOR

    if (room.controller.level > 5) {
        room.memory.buildings.extractor.active = true;
    }

    const counts: { [key in BuildableStructureConstant]?: number } = {};

    // BASE CENTER

    for (let x = 0; x < baseCenterLayout.length; x++) {
        for (const element of baseCenterLayout[x]) {
            switch (element.type) {
                case STRUCTURE_ROAD:
                    if (!roadsActive) {
                        break;
                    }
                    if (counts[STRUCTURE_ROAD] === undefined) {
                        counts[STRUCTURE_ROAD] = 0;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_ROAD]! += 1;
                        break;
                    }
                    room.memory.buildings.roads[0][counts[STRUCTURE_ROAD]!].active = true;
                    counts[STRUCTURE_ROAD]! += 1;
                    break;
                case STRUCTURE_RAMPART:
                    if (counts[STRUCTURE_RAMPART] === undefined) {
                        const terrain: RoomTerrain = room.getTerrain();
                        let i = 5;
                        for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
                            const pos: RoomPosition = offsetPositionByDirection(
                                room.controller.pos,
                                dir as DirectionConstant
                            );
                            if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                                i++;
                            }
                        }
                        counts[STRUCTURE_RAMPART] = i;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_RAMPART]! += 1;
                        break;
                    }
                    room.memory.buildings.ramparts[counts[STRUCTURE_RAMPART]!].active = true;
                    counts[STRUCTURE_RAMPART]! += 1;
                    break;
                case STRUCTURE_EXTENSION:
                    if (counts[STRUCTURE_EXTENSION] === undefined) {
                        counts[STRUCTURE_EXTENSION] = 0;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_EXTENSION]! += 1;
                        break;
                    }
                    room.memory.buildings.extensions[counts[STRUCTURE_EXTENSION]!].active = true;
                    counts[STRUCTURE_EXTENSION]! += 1;
                    break;
                case STRUCTURE_LAB:
                    if (counts[STRUCTURE_LAB] === undefined) {
                        counts[STRUCTURE_LAB] = 0;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_LAB]! += 1;
                        break;
                    }
                    room.memory.buildings.labs[counts[STRUCTURE_LAB]!].active = true;
                    counts[STRUCTURE_LAB]! += 1;
                    break;
                case STRUCTURE_LINK:
                    if (counts[STRUCTURE_LINK] === undefined) {
                        counts[STRUCTURE_LINK] = 3;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_LINK]! += 1;
                        break;
                    }
                    room.memory.buildings.links[counts[STRUCTURE_LINK]!].active = true;
                    counts[STRUCTURE_LINK]! += 1;
                    break;
                case STRUCTURE_SPAWN:
                    if (counts[STRUCTURE_SPAWN] === undefined) {
                        counts[STRUCTURE_SPAWN] = 0;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_SPAWN]! += 1;
                        break;
                    }
                    room.memory.buildings.spawns[counts[STRUCTURE_SPAWN]!].active = true;
                    counts[STRUCTURE_SPAWN]! += 1;
                    break;
                case STRUCTURE_CONTAINER:
                    if (counts[STRUCTURE_CONTAINER] === undefined) {
                        counts[STRUCTURE_CONTAINER] = 4;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_CONTAINER]! += 1;
                        break;
                    }
                    room.memory.buildings.containers[counts[STRUCTURE_CONTAINER]!].active = true;
                    counts[STRUCTURE_CONTAINER]! += 1;
                    break;
                case STRUCTURE_TOWER:
                    if (counts[STRUCTURE_TOWER] === undefined) {
                        counts[STRUCTURE_TOWER] = 0;
                    }
                    if (room.controller.level < x) {
                        counts[STRUCTURE_TOWER]! += 1;
                        break;
                    }
                    room.memory.buildings.towers[counts[STRUCTURE_TOWER]!].active = true;
                    counts[STRUCTURE_TOWER]! += 1;
                    break;
                case STRUCTURE_STORAGE:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.storage.active = true;
                    break;
                case STRUCTURE_TERMINAL:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.terminal.active = true;
                    break;
                case STRUCTURE_FACTORY:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.factory.active = true;
                    break;
                case STRUCTURE_POWER_SPAWN:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.powerspawn.active = true;
                    break;
                case STRUCTURE_NUKER:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.nuker.active = true;
                    break;
                case STRUCTURE_OBSERVER:
                    if (room.controller.level < x) {
                        break;
                    }
                    room.memory.buildings.observer.active = true;
                    break;
                default:
                    console.log("non handled structure : " + element.type);
                    break;
            }
        }
    }

    // BUNKER / AUTO

    const baseType: BaseType = room.memory.layout.baseType;

    if (baseType === "bunker") {
        for (let i = 0; i <= Math.min(room.controller.level, bunkerLayout.length - 1); i++) {
            for (const element of bunkerLayout[i]) {
                switch (element.type) {
                    case STRUCTURE_ROAD:
                        if (!roadsActive) {
                            break;
                        }
                        if (counts[STRUCTURE_ROAD] === undefined) {
                            counts[STRUCTURE_ROAD] = 0;
                        }
                        room.memory.buildings.roads[0][counts[STRUCTURE_ROAD]!].active = true;
                        counts[STRUCTURE_ROAD]! += 1;
                        break;
                    case STRUCTURE_RAMPART:
                        if (counts[STRUCTURE_RAMPART] === undefined) {
                            const terrain: RoomTerrain = room.getTerrain();
                            let i = 5;
                            for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
                                const pos: RoomPosition = offsetPositionByDirection(
                                    room.controller.pos,
                                    dir as DirectionConstant
                                );
                                if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                                    i++;
                                }
                            }
                            counts[STRUCTURE_RAMPART] = i;
                        }
                        room.memory.buildings.ramparts[counts[STRUCTURE_RAMPART]!].active = true;
                        counts[STRUCTURE_RAMPART]! += 1;
                        break;
                    case STRUCTURE_EXTENSION:
                        if (counts[STRUCTURE_EXTENSION] === undefined) {
                            counts[STRUCTURE_EXTENSION] = 0;
                        }
                        room.memory.buildings.extensions[counts[STRUCTURE_EXTENSION]!].active = true;
                        counts[STRUCTURE_EXTENSION]! += 1;
                        break;
                    case STRUCTURE_LAB:
                        if (counts[STRUCTURE_LAB] === undefined) {
                            counts[STRUCTURE_LAB] = 0;
                        }
                        room.memory.buildings.labs[counts[STRUCTURE_LAB]!].active = true;
                        counts[STRUCTURE_LAB]! += 1;
                        break;
                    case STRUCTURE_LINK:
                        if (counts[STRUCTURE_LINK] === undefined) {
                            counts[STRUCTURE_LINK] = 3;
                        }
                        room.memory.buildings.links[counts[STRUCTURE_LINK]!].active = true;
                        counts[STRUCTURE_LINK]! += 1;
                        break;
                    case STRUCTURE_SPAWN:
                        if (counts[STRUCTURE_SPAWN] === undefined) {
                            counts[STRUCTURE_SPAWN] = 0;
                        }
                        room.memory.buildings.spawns[counts[STRUCTURE_SPAWN]!].active = true;
                        counts[STRUCTURE_SPAWN]! += 1;
                        break;
                    case STRUCTURE_CONTAINER:
                        if (counts[STRUCTURE_CONTAINER] === undefined) {
                            counts[STRUCTURE_CONTAINER] = 4;
                        }
                        room.memory.buildings.containers[counts[STRUCTURE_CONTAINER]!].active = true;
                        counts[STRUCTURE_CONTAINER]! += 1;
                        break;
                    case STRUCTURE_TOWER:
                        if (counts[STRUCTURE_TOWER] === undefined) {
                            counts[STRUCTURE_TOWER] = 0;
                        }
                        room.memory.buildings.towers[counts[STRUCTURE_TOWER]!].active = true;
                        counts[STRUCTURE_TOWER]! += 1;
                        break;
                    case STRUCTURE_STORAGE:
                        room.memory.buildings.storage.active = true;
                        break;
                    case STRUCTURE_TERMINAL:
                        room.memory.buildings.terminal.active = true;
                        break;
                    case STRUCTURE_FACTORY:
                        room.memory.buildings.factory.active = true;
                        break;
                    case STRUCTURE_POWER_SPAWN:
                        room.memory.buildings.powerspawn.active = true;
                        break;
                    case STRUCTURE_NUKER:
                        room.memory.buildings.nuker.active = true;
                        break;
                    case STRUCTURE_OBSERVER:
                        room.memory.buildings.observer.active = true;
                        break;
                    default:
                        console.log("non handled structure : " + element.type);
                        break;
                }
            }
        }
    } else if (baseType === "auto") {
        const memory = room.memory.layout as AutoLayoutData;

        // LABS

        for (let x = 0; x < autoLabsLayout.length; x++) {
            for (const element of autoLabsLayout[x]) {
                switch (element.type) {
                    case STRUCTURE_ROAD:
                        if (!roadsActive) {
                            break;
                        }
                        if (counts[STRUCTURE_ROAD] === undefined) {
                            counts[STRUCTURE_ROAD] = 0;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_ROAD]! += 1;
                            break;
                        }
                        room.memory.buildings.roads[0][counts[STRUCTURE_ROAD]!].active = true;
                        counts[STRUCTURE_ROAD]! += 1;
                        break;
                    case STRUCTURE_RAMPART:
                        if (counts[STRUCTURE_RAMPART] === undefined) {
                            const terrain: RoomTerrain = room.getTerrain();
                            let i = 5;
                            for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
                                const pos: RoomPosition = offsetPositionByDirection(
                                    room.controller.pos,
                                    dir as DirectionConstant
                                );
                                if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                                    i++;
                                }
                            }
                            counts[STRUCTURE_RAMPART] = i;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_RAMPART]! += 1;
                            break;
                        }
                        room.memory.buildings.ramparts[counts[STRUCTURE_RAMPART]!].active = true;
                        counts[STRUCTURE_RAMPART]! += 1;
                        break;
                    case STRUCTURE_EXTENSION:
                        if (counts[STRUCTURE_EXTENSION] === undefined) {
                            counts[STRUCTURE_EXTENSION] = 0;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_EXTENSION]! += 1;
                            break;
                        }
                        room.memory.buildings.extensions[counts[STRUCTURE_EXTENSION]!].active = true;
                        counts[STRUCTURE_EXTENSION]! += 1;
                        break;
                    case STRUCTURE_LAB:
                        if (counts[STRUCTURE_LAB] === undefined) {
                            counts[STRUCTURE_LAB] = 0;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_LAB]! += 1;
                            break;
                        }
                        room.memory.buildings.labs[counts[STRUCTURE_LAB]!].active = true;
                        counts[STRUCTURE_LAB]! += 1;
                        break;
                    case STRUCTURE_LINK:
                        if (counts[STRUCTURE_LINK] === undefined) {
                            counts[STRUCTURE_LINK] = 3;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_LINK]! += 1;
                            break;
                        }
                        room.memory.buildings.links[counts[STRUCTURE_LINK]!].active = true;
                        counts[STRUCTURE_LINK]! += 1;
                        break;
                    case STRUCTURE_SPAWN:
                        if (counts[STRUCTURE_SPAWN] === undefined) {
                            counts[STRUCTURE_SPAWN] = 0;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_SPAWN]! += 1;
                            break;
                        }
                        room.memory.buildings.spawns[counts[STRUCTURE_SPAWN]!].active = true;
                        counts[STRUCTURE_SPAWN]! += 1;
                        break;
                    case STRUCTURE_CONTAINER:
                        if (counts[STRUCTURE_CONTAINER] === undefined) {
                            counts[STRUCTURE_CONTAINER] = 4;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_CONTAINER]! += 1;
                            break;
                        }
                        room.memory.buildings.containers[counts[STRUCTURE_CONTAINER]!].active = true;
                        counts[STRUCTURE_CONTAINER]! += 1;
                        break;
                    case STRUCTURE_TOWER:
                        if (counts[STRUCTURE_TOWER] === undefined) {
                            counts[STRUCTURE_TOWER] = 0;
                        }
                        if (room.controller.level < x) {
                            counts[STRUCTURE_TOWER]! += 1;
                            break;
                        }
                        room.memory.buildings.towers[counts[STRUCTURE_TOWER]!].active = true;
                        counts[STRUCTURE_TOWER]! += 1;
                        break;
                    case STRUCTURE_STORAGE:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.storage.active = true;
                        break;
                    case STRUCTURE_TERMINAL:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.terminal.active = true;
                        break;
                    case STRUCTURE_FACTORY:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.factory.active = true;
                        break;
                    case STRUCTURE_POWER_SPAWN:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.powerspawn.active = true;
                        break;
                    case STRUCTURE_NUKER:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.nuker.active = true;
                        break;
                    case STRUCTURE_OBSERVER:
                        if (room.controller.level < x) {
                            break;
                        }
                        room.memory.buildings.observer.active = true;
                        break;
                    default:
                        console.log("non handled structure : " + element.type);
                        break;
                }
            }
        }

        // EXTENSIONS

        for (let x = 0; x < memory.extensions.length; x++) {
            const node = x < 2 ? autoExtensionSpawnNode : autoExtensionNode;
            for (const element of node) {
                switch (element.type) {
                    case STRUCTURE_ROAD:
                        if (!roadsActive) {
                            break;
                        }
                        if (counts[STRUCTURE_ROAD] === undefined) {
                            counts[STRUCTURE_ROAD] = 0;
                        }
                        if (autoExtensionNodeCount[room.controller.level] <= x) {
                            counts[STRUCTURE_ROAD]! += 1;
                            break;
                        }
                        room.memory.buildings.roads[0][counts[STRUCTURE_ROAD]!].active = true;
                        counts[STRUCTURE_ROAD]! += 1;
                        break;
                    case STRUCTURE_RAMPART:
                        if (counts[STRUCTURE_RAMPART] === undefined) {
                            const terrain: RoomTerrain = room.getTerrain();
                            let i = 5;
                            for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
                                const pos: RoomPosition = offsetPositionByDirection(
                                    room.controller.pos,
                                    dir as DirectionConstant
                                );
                                if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                                    i++;
                                }
                            }
                            counts[STRUCTURE_RAMPART] = i;
                        }
                        if (autoExtensionNodeCount[room.controller.level] <= x) {
                            counts[STRUCTURE_RAMPART]! += 1;
                            break;
                        }
                        room.memory.buildings.ramparts[counts[STRUCTURE_RAMPART]!].active = true;
                        counts[STRUCTURE_RAMPART]! += 1;
                        break;
                    case STRUCTURE_EXTENSION:
                        if (counts[STRUCTURE_EXTENSION] === undefined) {
                            counts[STRUCTURE_EXTENSION] = 0;
                        }
                        if (autoExtensionNodeCount[room.controller.level] <= x) {
                            counts[STRUCTURE_EXTENSION]! += 1;
                            break;
                        }
                        room.memory.buildings.extensions[counts[STRUCTURE_EXTENSION]!].active = true;
                        counts[STRUCTURE_EXTENSION]! += 1;
                        break;
                    case STRUCTURE_SPAWN:
                        if (counts[STRUCTURE_SPAWN] === undefined) {
                            counts[STRUCTURE_SPAWN] = 0;
                        }
                        if (autoExtensionNodeCount[room.controller.level] <= x) {
                            counts[STRUCTURE_SPAWN]! += 1;
                            break;
                        }
                        room.memory.buildings.spawns[counts[STRUCTURE_SPAWN]!].active = true;
                        counts[STRUCTURE_SPAWN]! += 1;
                        break;
                    default:
                        break;
                }
            }
        }

        // SOURCE EXTENSIONS
        let x = 0;
        for (const source of memory.sources) {
            if (source.extensions.length > 0) {
                for (const extension of source.extensions) {
                    if ((room.controller.level >= 2 && x === 0) || (room.controller.level >= 3 && x === 1)) {
                        room.memory.buildings.extensions[counts[STRUCTURE_EXTENSION]!].active = true;
                    }
                    counts[STRUCTURE_EXTENSION]! += 1;
                    x++;
                }
            }
        }

        // RAMPARTS

        for (const element of memory.ramparts) {
            if (counts[STRUCTURE_RAMPART] === undefined) {
                const terrain: RoomTerrain = room.getTerrain();
                let i = 5;
                for (let dir: DirectionConstant = 1; dir <= 8; dir++) {
                    const pos: RoomPosition = offsetPositionByDirection(room.controller.pos, dir as DirectionConstant);
                    if (terrain.get(pos.x, pos.y) !== TERRAIN_MASK_WALL) {
                        i++;
                    }
                }
                counts[STRUCTURE_RAMPART] = i;
            }
            if (room.controller.level < 5) {
                //Hardcoded level for rampart bulding start
                counts[STRUCTURE_RAMPART]! += 1;
                break;
            }
            room.memory.buildings.ramparts[counts[STRUCTURE_RAMPART]!].active = true;
            counts[STRUCTURE_RAMPART]! += 1;
        }
    }
}

// BuildBuildings(room)
// Creates constructions sites and updates ids
// Removes inactive buildings

function _BuildBuildings(room: Room) {
    if (room.memory.buildings === undefined) {
        return;
    }
    for (const roads of room.memory.buildings.roads) {
        for (let road of roads) {
            _BuildBuilding(road, STRUCTURE_ROAD);
        }
    }
    let rampartsLeft = 10 - room.find(FIND_CONSTRUCTION_SITES).length;
    //TODO change 10 into a constant
    for (const rampart of room.memory.buildings.ramparts) {
        if (rampartsLeft <= 0) {
            break;
        }
        const res = _BuildBuilding(rampart, STRUCTURE_RAMPART);
        if (res) {
            rampartsLeft--;
        }
    }
    for (const extension of room.memory.buildings.extensions) {
        _BuildBuilding(extension, STRUCTURE_EXTENSION);
    }
    for (const tower of room.memory.buildings.towers) {
        _BuildBuilding(tower, STRUCTURE_TOWER);
    }
    for (const lab of room.memory.buildings.labs) {
        _BuildBuilding(lab, STRUCTURE_LAB);
    }
    for (const link of room.memory.buildings.links) {
        _BuildBuilding(link, STRUCTURE_LINK);
    }
    for (const spawn of room.memory.buildings.spawns) {
        _BuildBuilding(spawn, STRUCTURE_SPAWN);
    }
    for (const container of room.memory.buildings.containers) {
        _BuildBuilding(container, STRUCTURE_CONTAINER);
    }
    _BuildBuilding(room.memory.buildings.storage, STRUCTURE_STORAGE);
    _BuildBuilding(room.memory.buildings.terminal, STRUCTURE_TERMINAL);
    _BuildBuilding(room.memory.buildings.factory, STRUCTURE_FACTORY);
    _BuildBuilding(room.memory.buildings.powerspawn, STRUCTURE_POWER_SPAWN);
    _BuildBuilding(room.memory.buildings.nuker, STRUCTURE_NUKER);
    _BuildBuilding(room.memory.buildings.observer, STRUCTURE_OBSERVER);
    _BuildBuilding(room.memory.buildings.extractor, STRUCTURE_EXTRACTOR);
}

function _BuildBuilding<T extends BuildableStructureConstant>(
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
    if (building.id !== undefined) {
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
