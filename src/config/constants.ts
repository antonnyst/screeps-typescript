export const MINERAL_MINING_ENERGY_NEEDED = 50000;
export const BASE_LINK_GREEDY_LIMIT = 35000;
export const FULL_UPGRADER_ENERGY_NEEDED = 80000;

// How much of each resource type should be stored in the terminal
export const TERMINAL_ENERGY_MIN = 30000;
export const TERMINAL_ENERGY_MAX = 40000;
export const TERMINAL_MINERAL_MIN = 6000;
export const TERMINAL_MINERAL_MAX = 12000;
export const TERMINAL_BOOST_MIN = 1000;
export const TERMINAL_BOOST_MAX = 5000;
export const TERMINAL_COMMODITY_MIN = 1000;
export const TERMINAL_COMMODITY_MAX = 5000;

// How much energy should be stored in the factory
export const FACTORY_ENERGY_MIN = 5000;
export const FACTORY_ENERGY_MAX = 10000;

// How much of each mineral should be stored in each room
export const ROOM_MINERAL_IMPORT_LIMIT = 12000;
export const ROOM_MINERAL_EXPORT_LIMIT = 24000;

// How much energy should be stored in each room
export const ROOM_ENERGY_IMPORT_LIMIT = 100000;
export const ROOM_ENERGY_EXPORT_LIMIT = 400000;

// How many percents of max health should rampart be maintained at
export const RAMPART_PERCENTAGE_MIN = 0.03;
export const RAMPART_PERCENTAGE_MAX = 0.04;

// Resource categorisation
export const TERMINAL_MINERALS: ResourceConstant[] = [
    RESOURCE_HYDROGEN,
    RESOURCE_OXYGEN,
    RESOURCE_UTRIUM,
    RESOURCE_KEANIUM,
    RESOURCE_LEMERGIUM,
    RESOURCE_ZYNTHIUM,
    RESOURCE_CATALYST
];

export const TERMINAL_BOOSTS: ResourceConstant[] = Object.keys(REACTION_TIME) as ResourceConstant[];

export const TERMINAL_COMMODITIES: ResourceConstant[] = Object.keys(COMMODITIES).filter((c) =>
    TERMINAL_MINERALS.includes(c as ResourceConstant)
) as ResourceConstant[];
