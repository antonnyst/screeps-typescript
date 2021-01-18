export interface SpawnData {
    pattern?: string;
    role?: string;
    energy?: number;
    memory?: CreepMemory;
    body?: BodyPartConstant[];
    directions?: DirectionConstant[];
    center?: boolean;
}
