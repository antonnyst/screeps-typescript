/*
 * data.ts stores and manages data
 */

import { Packer } from "./packer";

declare global {
    interface Memory {
        data: Record<DataName, Data>;
        backupLocations?: string;
        backupSegments?: string;
    }
}

type DataName = string;
type Data = string;
export type Layer = "memory" | "segment" | "heap";

interface Location {
    layer: Layer;
}
interface MemoryLocation extends Location {
    toSegment?: boolean;
}
interface SegmentLocation extends Location {
    segment: number;
    index: number;
    length: number;
}
interface HeapLocation extends Location {}
interface CachedData {
    tick: number;
    data: Data;
}
interface SegmentData {
    length: number;
}

// Keep cache data for so long
const CACHE_CLEAR_TIME: number = 5000;
// Move data from memory to segment when memory size exceeds this
const SEGMENT_MOVE_SIZE: number = 250;
// Stop adding data to segment when it reaches this size
const SEGMENT_TARGET_SIZE: number = 50000;

let locations: Partial<Record<DataName, Location>>;

let segments: Partial<Record<number, SegmentData>>;

let cache: Partial<Record<DataName, CachedData>>;
let heap: Partial<Record<DataName, string>>;

let activeSegments: number[] = [];
let requestedSegmets: number[] = [];

let amountMoveNeeded = 0;

export function Has(name: DataName): boolean {
    if (locations && locations[name] !== undefined && !(isHeapLocation(locations[name]!) && heap[name] === undefined)) {
        return true;
    }
    return false;
}

export function Prepare(name: DataName): void {
    if (cache === undefined || locations === undefined || segments === undefined || heap === undefined) {
        return;
    }
    if (locations[name] === undefined) {
        return;
    }
    const location = locations[name];
    if (location && isSegmentLocation(location)) {
        if (!requestedSegmets.includes(location.segment)) {
            requestedSegmets.push(location.segment);
        }
    }
}

export function Get(name: DataName): Data | null {
    if (cache === undefined || locations === undefined || segments === undefined || heap === undefined) {
        return null;
    }
    if (cache[name] !== undefined) {
        return cache[name]!.data;
    }
    if (locations[name] === undefined) {
        return null;
    }
    const location = locations[name];
    if (location && isMemoryLocation(location)) {
        return Memory.data[name];
    }
    if (location && isSegmentLocation(location)) {
        if (activeSegments.includes(location.segment)) {
            const data = RawMemory.segments[location.segment].substring(
                location.index,
                location.index + location.length
            );
            cache[name] = { tick: Game.time, data };
            return data;
        }
    }
    if (location && isHeapLocation(location)) {
        return heap[name] ?? null;
    }
    return null;
}

export function Set(name: DataName, data: Data, layer: Layer): void {
    if (cache === undefined || locations === undefined || segments === undefined) {
        return;
    }
    delete cache[name];
    if (data.length === 0) {
        delete locations[name];
        return;
    }
    switch (layer) {
        case "memory":
            _setMemory(name, data);
            break;
        case "segment":
            _setMemory(name, data, true);
            break;
        case "heap":
            _setHeap(name, data);
            break;
    }
}

function _setMemory(name: DataName, data: Data, toSegment?: boolean) {
    Memory.data[name] = data;
    locations[name] = { layer: "memory", toSegment } as MemoryLocation;
    Memory.backupLocations = packLocations(locations);
}

function _setHeap(name: DataName, data: Data) {
    heap[name] = data;
    locations[name] = { layer: "heap" } as HeapLocation;
    Memory.backupLocations = packLocations(locations);
}

export function tickData() {
    Memory.data = Memory.data ?? {};
    cache = cache ?? {};
    heap = heap ?? {};
    if (locations === undefined) {
        if (Memory.backupLocations !== undefined) {
            locations = unpackLocations(Memory.backupLocations);
        } else {
            locations = {};
        }
        Memory.backupLocations = packLocations(locations);
    }
    if (segments === undefined) {
        if (Memory.backupSegments !== undefined) {
            segments = unpackSegments(Memory.backupSegments);
        } else {
            segments = {};
        }
        Memory.backupSegments = packSegments(segments);
    }

    if (Game.time % 10 === 0) {
        // Check amount of data needed to be moved to segments
        amountMoveNeeded = checkMoveNeeded();
    }
    if (amountMoveNeeded >= SEGMENT_MOVE_SIZE) {
        // Start moving data to segment
        if (
            activeSegments.length > 0 &&
            activeSegments.some((s) => segments[s] === undefined || segments[s]!.length < SEGMENT_TARGET_SIZE)
        ) {
            // There is an empty segment we can move data to
            let segment: number | undefined = _.find(
                activeSegments,
                (s) => segments[s] === undefined || segments[s]!.length < SEGMENT_TARGET_SIZE
            );
            if (segment !== undefined) {
                let data = RawMemory.segments[segment];
                for (const dataName in locations) {
                    if (data.length >= SEGMENT_TARGET_SIZE) {
                        break;
                    }
                    const location = locations[dataName];
                    if (location && isMemoryLocation(location) && location.toSegment === true) {
                        locations[dataName] = {
                            layer: "segment",
                            segment,
                            index: data.length,
                            length: Memory.data[dataName].length
                        } as SegmentLocation;
                        data += Memory.data[dataName];
                        cache[dataName] = { data: Memory.data[dataName], tick: Game.time };
                        delete Memory.data[dataName];
                    }
                }
                RawMemory.segments[segment] = data;
                segments[segment] = {
                    length: data.length
                };
                Memory.backupSegments = packSegments(segments);
                Memory.backupLocations = packLocations(locations);
            }
        } else {
            // There is no unused segment in current active segments
            let index = -1;
            for (let i = 0; i < 100; i++) {
                if (segments[i] === undefined || segments[i]!.length < SEGMENT_TARGET_SIZE) {
                    index = i;
                    break;
                }
            }

            if (index >= 0 && !requestedSegmets.includes(index)) {
                requestedSegmets.push(index);
            }
        }
        amountMoveNeeded = checkMoveNeeded();
    }

    if (Game.time % CACHE_CLEAR_TIME === 0) {
        cleanCache();
    }

    activeSegments = [];
    for (let i = 0; i < Math.min(10, requestedSegmets.length); i++) {
        activeSegments.push(requestedSegmets[i]);
    }
    RawMemory.setActiveSegments(activeSegments);
    requestedSegmets = [];
    //Memory.backupLocations = packLocations(locations);
    //Memory.backupSegments = packSegments(segments);
}

function cleanCache() {
    for (const name in cache) {
        if (cache[name]!.tick < Game.time - CACHE_CLEAR_TIME) {
            delete cache[name];
        }
    }
}

function checkMoveNeeded(): number {
    let amount = 0;
    for (const dataName in locations) {
        const location = locations[dataName];
        if (location && isMemoryLocation(location) && location.toSegment === true) {
            amount += Memory.data[dataName].length;
        }
    }
    return amount;
}

function isMemoryLocation(location: Location): location is MemoryLocation {
    return location.layer === "memory";
}
function isSegmentLocation(location: Location): location is SegmentLocation {
    return location.layer === "segment";
}
function isHeapLocation(location: Location): location is HeapLocation {
    return location.layer === "heap";
}

function packLocations(locations: Partial<Record<DataName, Location>>): string {
    let savedLocations: Partial<Record<DataName, Location>> = {};
    for (let key in locations) {
        if (locations[key]?.layer !== "heap") {
            savedLocations[key] = locations[key];
        }
    }
    return JSON.stringify(savedLocations);
}
function unpackLocations(data: string): Record<DataName, Location> {
    return JSON.parse(data) as Record<DataName, Location>;
}
function packSegments(segments: Partial<Record<number, SegmentData>>): string {
    return JSON.stringify(segments);
}
function unpackSegments(data: string): Record<number, SegmentData> {
    return JSON.parse(data) as Record<number, SegmentData>;
}

export function fullSegmentReset() {
    Memory.backupLocations = undefined;
    Memory.backupSegments = undefined;
    for (const n in Memory.data) {
        delete Memory.data[n];
    }
    for (const i of activeSegments) {
        RawMemory.segments[i] = "";
    }
    locations = {};
    heap = {};
    cache = {};
    segments = {};
    activeSegments = [];
    requestedSegmets = [];
    amountMoveNeeded = 0;
}

interface DataInterface<T> {
    has: () => boolean;
    prepare: () => void;
    get: () => T | null;
    set: (value: T | null) => void;
}

export const DataInterface = <T>(dataName: string, packer: Packer<T>, layer: Layer): DataInterface<T> => {
    return {
        has: (): boolean => {
            return Has(dataName);
        },
        prepare: (): void => {
            Prepare(dataName);
        },
        get: (): T | null => {
            const data: string | null = Get(dataName);
            if (data === null) {
                return null;
            }
            return packer.unpack(data);
        },
        set: (value: T | null): void => {
            if (value === null) {
                Set(dataName, "", layer);
                return;
            }
            Set(dataName, packer.pack(value), layer);
        }
    };
};
