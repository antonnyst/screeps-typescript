declare namespace NodeJS {
    interface Global {
        Memory?: Memory;
    }
}

interface RawMemory {
    _parsed: Memory;
}

interface CreepMemory {
    home: string;
    checkIdle?: {
        idleCount: number;
        lastPos: RoomPosition;
    };
}

interface RoomMemory {
    roomLevel: number;
    reservation: ReservationDefinition | undefined;
    spawnAttempts?: number;
    remotes: string[];
    remoteSupportRooms: string[];
    lastUpdate: number;
}

interface Memory {
    cpuAvg: number;
    msplit: { [key in string]: number };
    cacheHits: number;
    totalQueries: number;
}

interface FlagMemory {
    processed?: boolean;
}
