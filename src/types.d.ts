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
    labrador?: {
        task: LabradorTask | undefined;
        qtask: LabradorTask[];
    };
    movementData?: import("./dataInterfaces/movementData").MovementData;
}

interface RoomMemory {
    roomLevel: number;
    hostiles: { [key: string]: import("./dataInterfaces/hostileData").HostileData };
    reservation: ReservationDefinition | undefined;
    spawnQueue: import("./dataInterfaces/spawnData").SpawnData[];
    waitingCreep?: import("./dataInterfaces/spawnData").SpawnData;
    spawnAttempts?: number;
    remotes: string[];
    remoteSupportRooms: string[];
    linkStatus: LinkStatus;
    labs?: import("./dataInterfaces/labsData").LabsData;
    resources?: import("./dataInterfaces/resourcesData").ResourcesData;
    rampartData?: import("./dataInterfaces/rampartData").RampartData;
    lastUpdate: number;
}

interface Memory {
    cpuAvg: number;
    msplit: { [key in string]: number };
    cacheHits: number;
    totalQueries: number;
    marketData: import("./dataInterfaces/marketData").MarketData;
}

declare type LinkStatus = "fill" | "empty";
declare type ActionType = "transfer" | "withdraw" | "pickup";

declare type BaseType = "bunker" | "auto";
declare type LabDirection = 0 | 1 | 2 | 3;

declare interface BuildInstruction {
    x: number;
    y: number;
    type: BuildableStructureConstant;
    name?: string;
}

declare type RoleCountFunction = (room: Room, creeps: Creep[]) => number;
declare type RoleNeedFunction = (room: Room) => number;
declare type RoleCalcFunction = (room: Room, delta: number) => void;

declare type CreepNeedCheckFunction = (
    room: Room,
    creeps: Creep[],
    counts: _.Dictionary<number>,
    roles: _.Dictionary<Creep[]>
) => import("./dataInterfaces/spawnData").SpawnData | null;

declare interface LabradorTask {
    id: Id<AnyStoreStructure | Resource | Tombstone>;
    resourceType: ResourceConstant;
    amount: number;
    type: ActionType;
}

interface FlagMemory {
    processed?: boolean;
}
