export const MINERAL_MINING_ENERGY_NEEDED = 50000;
export const PUSH_GCL_ENERGY_NEEDED = 500000;
export const POWER_PROCESSING_ENERGY_NEEDED = 100000;

// Deposit harvesting
export const DEPOSIT_MAX_COOLDOWN = 100;
export const DEPOSIT_MAX_RANGE = 4;

// PowerBank harvesting
export const POWER_BANK_MIN_AMOUNT = 2000;
export const POWER_BANK_MAX_RANGE = 3;

// How many percents of max health should rampart be maintained at
export const RAMPART_PERCENTAGE_MIN = 0.03;
export const RAMPART_PERCENTAGE_MAX = 0.04;

export type ResourceType =
  | "energy"
  | "power"
  | "mineral"
  | "raw_boost"
  | "boost"
  | "raw_commodity"
  | "commodity"
  | "compressed";

export const RESOURCE_TYPE: Record<ResourceConstant, ResourceType | undefined> = {
  energy: "energy",
  power: "power",
  ops: undefined,
  U: "mineral",
  L: "mineral",
  K: "mineral",
  Z: "mineral",
  O: "mineral",
  H: "mineral",
  X: "mineral",
  OH: "raw_boost",
  ZK: "raw_boost",
  UL: "raw_boost",
  G: "raw_boost",
  UH: "boost",
  UO: "boost",
  KH: "boost",
  KO: "boost",
  LH: "boost",
  LO: "boost",
  ZH: "boost",
  ZO: "boost",
  GH: "boost",
  GO: "boost",
  UH2O: "boost",
  UHO2: "boost",
  KH2O: "boost",
  KHO2: "boost",
  LH2O: "boost",
  LHO2: "boost",
  ZH2O: "boost",
  ZHO2: "boost",
  GH2O: "boost",
  GHO2: "boost",
  XUH2O: "boost",
  XUHO2: "boost",
  XKH2O: "boost",
  XKHO2: "boost",
  XLH2O: "boost",
  XLHO2: "boost",
  XZH2O: "boost",
  XZHO2: "boost",
  XGH2O: "boost",
  XGHO2: "boost",
  mist: "raw_commodity",
  biomass: "raw_commodity",
  metal: "raw_commodity",
  silicon: "raw_commodity",
  utrium_bar: "compressed",
  lemergium_bar: "compressed",
  zynthium_bar: "compressed",
  keanium_bar: "compressed",
  ghodium_melt: "compressed",
  oxidant: "compressed",
  reductant: "compressed",
  purifier: "compressed",
  battery: "compressed",
  composite: "compressed",
  crystal: "compressed",
  liquid: "compressed",
  wire: "commodity",
  switch: "commodity",
  transistor: "commodity",
  microchip: "commodity",
  circuit: "commodity",
  device: "commodity",
  cell: "commodity",
  phlegm: "commodity",
  tissue: "commodity",
  muscle: "commodity",
  organoid: "commodity",
  organism: "commodity",
  alloy: "commodity",
  tube: "commodity",
  fixtures: "commodity",
  frame: "commodity",
  hydraulics: "commodity",
  machine: "commodity",
  condensate: "commodity",
  concentrate: "commodity",
  extract: "commodity",
  spirit: "commodity",
  emanation: "commodity",
  essence: "commodity"
};

export const RESOURCE_LIMITS: Record<
  ResourceType,
  {
    terminal: {
      min: number;
      max: number;
    };
    room: {
      import: number;
      export: number;
      sell: number | null;
    };
  }
> = {
  energy: {
    terminal: {
      min: 30000,
      max: 40000
    },
    room: {
      import: 250000,
      export: 400000,
      sell: null
    }
  },
  power: {
    terminal: {
      min: 2000,
      max: 2000
    },
    room: {
      import: 0,
      export: 0,
      sell: null
    }
  },
  mineral: {
    terminal: {
      min: 6000,
      max: 12000
    },
    room: {
      import: 10000,
      export: 20000,
      sell: 25000
    }
  },
  raw_boost: {
    terminal: {
      min: 3000,
      max: 6000
    },
    room: {
      import: 2000,
      export: 7000,
      sell: null
    }
  },
  boost: {
    terminal: {
      min: 3000,
      max: 6000
    },
    room: {
      import: 2000,
      export: 7000,
      sell: null
    }
  },
  raw_commodity: {
    terminal: {
      min: 3000,
      max: 6000
    },
    room: {
      import: 2000,
      export: 7000,
      sell: 24000
    }
  },
  commodity: {
    terminal: {
      min: 1000,
      max: 1000
    },
    room: {
      import: 0,
      export: 0,
      sell: null
    }
  },
  compressed: {
    terminal: {
      min: 2000,
      max: 4000
    },
    room: {
      import: 0,
      export: 0,
      sell: null
    }
  }
};

export const MARKET_RESOURCES: MarketResourceConstant[] = (RESOURCES_ALL as MarketResourceConstant[]).concat(
  Object.values(INTERSHARD_RESOURCES) as MarketResourceConstant[]
);

/**
 * Posted 13 March 2018 by @shibdib
 * Boost Components
 */
export const BOOST_COMPONENTS: Partial<Record<ResourceConstant, ResourceConstant[]>> = {
  // Tier 3
  [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_GHODIUM_ACID]: [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: [RESOURCE_ZYNTHIUM_ACID, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: [RESOURCE_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_LEMERGIUM_ACID]: [RESOURCE_LEMERGIUM_ACID, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_KEANIUM_ACID]: [RESOURCE_KEANIUM_ACID, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_UTRIUM_ACID]: [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST],
  [RESOURCE_CATALYZED_UTRIUM_ALKALIDE]: [RESOURCE_UTRIUM_ALKALIDE, RESOURCE_CATALYST],
  // Tier 2
  [RESOURCE_GHODIUM_ACID]: [RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_GHODIUM_ALKALIDE]: [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_ZYNTHIUM_ACID]: [RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_ZYNTHIUM_ALKALIDE]: [RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_LEMERGIUM_ALKALIDE]: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_LEMERGIUM_ACID]: [RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_KEANIUM_ALKALIDE]: [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_KEANIUM_ACID]: [RESOURCE_KEANIUM_HYDRIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_UTRIUM_ACID]: [RESOURCE_UTRIUM_HYDRIDE, RESOURCE_HYDROXIDE],
  [RESOURCE_UTRIUM_ALKALIDE]: [RESOURCE_UTRIUM_OXIDE, RESOURCE_HYDROXIDE],
  // Tier 1
  [RESOURCE_GHODIUM_HYDRIDE]: [RESOURCE_GHODIUM, RESOURCE_HYDROGEN],
  [RESOURCE_GHODIUM_OXIDE]: [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
  [RESOURCE_ZYNTHIUM_HYDRIDE]: [RESOURCE_ZYNTHIUM, RESOURCE_HYDROGEN],
  [RESOURCE_ZYNTHIUM_OXIDE]: [RESOURCE_ZYNTHIUM, RESOURCE_OXYGEN],
  [RESOURCE_LEMERGIUM_OXIDE]: [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN],
  [RESOURCE_LEMERGIUM_HYDRIDE]: [RESOURCE_LEMERGIUM, RESOURCE_HYDROGEN],
  [RESOURCE_KEANIUM_OXIDE]: [RESOURCE_KEANIUM, RESOURCE_OXYGEN],
  [RESOURCE_KEANIUM_HYDRIDE]: [RESOURCE_KEANIUM, RESOURCE_HYDROGEN],
  [RESOURCE_UTRIUM_HYDRIDE]: [RESOURCE_UTRIUM, RESOURCE_HYDROGEN],
  [RESOURCE_UTRIUM_OXIDE]: [RESOURCE_UTRIUM, RESOURCE_OXYGEN],
  // Base
  [RESOURCE_GHODIUM]: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE],
  [RESOURCE_HYDROXIDE]: [RESOURCE_OXYGEN, RESOURCE_HYDROGEN],
  [RESOURCE_ZYNTHIUM_KEANITE]: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM],
  [RESOURCE_UTRIUM_LEMERGITE]: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM]
};
