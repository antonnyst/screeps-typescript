/*
 * data.ts stores and manages data
 */

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
type HeapLocation = Location;
interface CachedData {
  tick: number;
  data: Data;
}
interface SegmentData {
  length: number;
}

// Keep cache data for so long
const CACHE_CLEAR_TIME = 5000;
// Move data from memory to segment when memory size exceeds this
const SEGMENT_MOVE_SIZE = 250;
// Stop adding data to segment when it reaches this size
const SEGMENT_TARGET_SIZE = 50000;

let locations: Partial<Record<DataName, Location>>;

let segments: Partial<Record<number, SegmentData>>;

let cache: Partial<Record<DataName, CachedData>>;
let heap: Partial<Record<DataName, string>>;

let activeSegments: number[] = [];
let requestedSegmets: number[] = [];

let prepareLocations: DataName[] = [];
// eslint-disable-next-line no-underscore-dangle
let _prepareLocations: DataName[] = [];

let amountMoveNeeded = 0;

export function Has(name: DataName): boolean {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    prepareLocations.push(name);
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
      const data = RawMemory.segments[location.segment].substring(location.index, location.index + location.length);
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

// eslint-disable-next-line no-underscore-dangle
function _setMemory(name: DataName, data: Data, toSegment?: boolean) {
  Memory.data[name] = data;
  locations[name] = { layer: "memory", toSegment } as MemoryLocation;
  Memory.backupLocations = packLocations(locations);
}

// eslint-disable-next-line no-underscore-dangle
function _setHeap(name: DataName, data: Data) {
  heap[name] = data;
  locations[name] = { layer: "heap" } as HeapLocation;
  Memory.backupLocations = packLocations(locations);
}

export function tickData(): void {
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      activeSegments.some(s => segments[s] === undefined || segments[s]!.length < SEGMENT_TARGET_SIZE)
    ) {
      // There is an empty segment we can move data to
      const segment: number | undefined = _.find(
        activeSegments,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        s => segments[s] === undefined || segments[s]!.length < SEGMENT_TARGET_SIZE
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  for (const name of _prepareLocations) {
    Get(name);
  }
  _prepareLocations = prepareLocations;
  prepareLocations = [];

  activeSegments = [];
  for (let i = 0; i < Math.min(10, requestedSegmets.length); i++) {
    activeSegments.push(requestedSegmets[i]);
  }
  RawMemory.setActiveSegments(activeSegments);
  requestedSegmets = [];
}

function cleanCache() {
  for (const name in cache) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

// eslint-disable-next-line @typescript-eslint/no-shadow
function packLocations(locations: Partial<Record<DataName, Location>>): string {
  const saved: (string | string[])[] = [];
  for (const key in locations) {
    const location = locations[key];
    if (location !== undefined && location.layer !== "heap") {
      saved.push(key);
      saved.push(packLocation(location));
    }
  }
  return JSON.stringify(saved);
}
function unpackLocations(data: string): Partial<Record<DataName, Location>> {
  const array = JSON.parse(data) as (string | string[])[];
  const result: Partial<Record<DataName, Location>> = {};
  for (let i = 0; i < array.length; i += 2) {
    result[array[i] as string] = unpackLocation(array[i + 1] as string[]);
  }
  return result;
}

function packLocation(location: Location): string[] {
  const result: string[] = [];
  result.push(location.layer);
  switch (location.layer) {
    case "heap":
      throw Error("Cannot pack heap location");
    case "memory":
      if (isMemoryLocation(location)) {
        switch (location.toSegment) {
          case false:
            result.push("0");
            break;
          case true:
            result.push("1");
            break;
          case undefined:
            result.push("2");
            break;
        }
      }
      break;
    case "segment":
      if (isSegmentLocation(location)) {
        result.push(location.segment.toString(16));
        result.push(location.index.toString(16));
        result.push(location.length.toString(16));
      }
      break;
  }
  return result;
}

function unpackLocation(data: string[]): Location {
  switch (data[0]) {
    case "heap":
      throw Error("Cannot unpack heap location");
    case "memory": {
      let toSegment;
      switch (data[1]) {
        case "0":
          toSegment = false;
          break;
        case "1":
          toSegment = true;
          break;
      }
      return {
        layer: data[0],
        toSegment
      } as MemoryLocation;
    }
    case "segment": {
      return {
        layer: data[0],
        segment: parseInt(data[1], 16),
        index: parseInt(data[2], 16),
        length: parseInt(data[3], 16)
      } as SegmentLocation;
    }
  }
  throw Error("Invalid data");
}

// eslint-disable-next-line @typescript-eslint/no-shadow
function packSegments(segments: Partial<Record<number, SegmentData>>): string {
  return JSON.stringify(segments);
}
function unpackSegments(data: string): Record<number, SegmentData> {
  return JSON.parse(data) as Record<number, SegmentData>;
}

export function fullSegmentReset(): void {
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
