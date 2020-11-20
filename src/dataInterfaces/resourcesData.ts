export interface ResourcesData {
    total: { [resourceType in ResourceConstant]: number };
    delta: { [resourceType in ResourceConstant]: number };
}
