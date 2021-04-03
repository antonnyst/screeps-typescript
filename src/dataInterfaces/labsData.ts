export interface LabsData {
    status: string;
    labs: LabData[];
    inLabs: number[];
    outLabs: number[];
}
export interface LabData {
    id: Id<StructureLab>;
    targetResource: ResourceConstant | null;
}
