import { RoomData } from "data/room/room";
import { isOwnedRoom } from "../utils/RoomCalc";

declare global {
  interface Memory {
    stats?: Stats;
  }
}

interface Stats {
  time?: number;
  globalReset?: number;
  creeps?: {
    total: number;
    roles: { [key in string]: number };
  };
  cpu?: {
    used: number;
    limit: number;
    bucket: number;
    msplit: { [key in string]: number };
  };
  gcl?: {
    progress: number;
    progressTotal: number;
    level: number;
  };
  rooms?: {
    [key in string]: RoomStats;
  };
  pathfinding?: {
    cacheHits: number;
    totalQueries: number;
  };
  accountResources?: {
    [key in InterShardResourceConstant]: number;
  };
  credits?: number;
  prices?: {
    [key in MarketResourceConstant]?: {
      sell: number;
      buy: number;
    };
  };
  heap?: HeapStatistics;
  memory?: number;
  segments?: { [key in string]?: number };
}

interface RoomStats {
  energystored: number;
  controller: {
    level: number;
    progress: number;
    progressTotal: number;
  };
  rampartavg: number;
  rampartmin: number;
  rampartmax: number;
  resources?: {
    [key in ResourceConstant]: number;
  };
  energyCapacityAvailable: number;
  energyAvailable: number;
  sources: { energy: number; capacity: number }[];
}

export function saveInit(): void {
  if (Game.shard.name !== "shard3") {
    return;
  }
  if (Memory.stats === undefined) {
    Memory.stats = {
      globalReset: Game.time
    };
  } else {
    Memory.stats.globalReset = Game.time;
  }
}

export function saveTick(): void {
  if (Game.shard.name !== "shard3") {
    return;
  }
  if (Memory.stats === undefined) {
    Memory.stats = {};
  }
  Memory.stats.time = Game.time;
  Memory.stats.creeps = {
    total: Object.keys(Game.creeps).length,
    roles: _.countBy(Game.creeps, c => c.memory.role)
  };
  Memory.stats.cpu = {
    used: 0,
    limit: Game.cpu.limit,
    bucket: Game.cpu.bucket,
    msplit: Memory.msplit
  };
  Memory.stats.gcl = {
    level: Game.gcl.level,
    progress: Game.gcl.progress,
    progressTotal: Game.gcl.progressTotal
  };
  Memory.stats.pathfinding = {
    cacheHits: Memory.cacheHits,
    totalQueries: Memory.totalQueries
  };
  /* eslint-disable @typescript-eslint/no-unsafe-assignment */
  Memory.stats.accountResources = {
    token: Game.resources[SUBSCRIPTION_TOKEN],
    cpuUnlock: Game.resources[CPU_UNLOCK],
    pixel: Game.resources[PIXEL],
    accessKey: Game.resources[ACCESS_KEY]
  };
  /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  Memory.stats.credits = Game.market.credits;
  Memory.stats.prices = Memory.marketData.prices;
  if (Game.cpu.getHeapStatistics !== undefined) {
    Memory.stats.heap = Game.cpu.getHeapStatistics();
  }

  Memory.stats.segments = Memory.stats.segments ?? {};
  for (const segment of Object.keys(RawMemory.segments)) {
    Memory.stats.segments[segment] = RawMemory.segments[parseInt(segment, 10)].length;
  }

  Memory.stats.memory = RawMemory.get().length;

  Memory.stats.cpu.used = Game.cpu.getUsed();
}

export function saveRooms(): void {
  if (Game.shard.name !== "shard3") {
    return;
  }
  if (Memory.stats === undefined) {
    Memory.stats = {};
  }
  Memory.stats.rooms = {};
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (
      isOwnedRoom(room) &&
      room.memory.genBuildings !== undefined &&
      room.memory.resources !== undefined &&
      room.memory.genLayout !== undefined
    ) {
      const energystored = room.memory.resources.total.energy;
      const resources = room.memory.resources.total;

      let rampartamt = 0;
      let ramparthits = 0;
      let rampartmin = Infinity;
      let rampartmax = 0;

      for (const rampart of room.memory.genBuildings.ramparts) {
        if (rampart.id !== undefined) {
          const rampartObject = Game.getObjectById(rampart.id);
          if (rampartObject instanceof StructureRampart) {
            rampartamt++;
            ramparthits += rampartObject.hits;
            rampartmin = Math.min(rampartmin, rampartObject.hits);
            rampartmax = Math.max(rampartmax, rampartObject.hits);
          }
        }
      }

      const rampartavg = ramparthits / rampartamt;

      const sources: { energy: number; capacity: number }[] = [];

      const basicRoomData = RoomData(room.name).basicRoomData.get();

      if (basicRoomData !== null) {
        for (const source of basicRoomData.sources) {
          const object = Game.getObjectById(source.id);
          if (object !== null) {
            sources.push({
              energy: object.energy,
              capacity: object.energyCapacity
            });
          }
        }
      }

      Memory.stats.rooms[roomName] = {
        controller: {
          level: room.controller.level,
          progress: room.controller.progress,
          progressTotal: room.controller.progressTotal
        },
        energystored,
        rampartavg,
        rampartmin,
        rampartmax,
        resources,
        energyCapacityAvailable: room.energyCapacityAvailable,
        energyAvailable: room.energyAvailable,
        sources
      };
    }
  }
}
