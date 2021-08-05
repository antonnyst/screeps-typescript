declare namespace NodeJS {
    interface Global {
        Memory?: Memory;
    }
}

interface RawMemory {
    _parsed: Memory;
}

interface CreepMemory {
    role: string;
    home: string;
    roleData?: {
        target?: string;
        targetId?: string;
        hasEnergy?: boolean;
        anyStore?: any;
    };
    checkIdle?: {
        idleCount: number;
        lastPos: RoomPosition;
    };
    getEnergy?: {
        target?: string;
    };
    boost?: {
        [resource in MineralBoostConstant]: number;
    };
    _move?: any;
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
