export interface LayoutPrefab {
  buildings: {
    dx: number;
    dy: number;
    type: BuildableStructureConstant;
  }[];
}

export const centerPrefab: LayoutPrefab = {
  buildings: [
    { dx: 0, dy: -1, type: STRUCTURE_TERMINAL },
    { dx: 1, dy: -1, type: STRUCTURE_FACTORY },
    { dx: 1, dy: 0, type: STRUCTURE_POWER_SPAWN },
    { dx: 0, dy: 1, type: STRUCTURE_LINK },
    { dx: -1, dy: 1, type: STRUCTURE_SPAWN },
    { dx: -1, dy: 0, type: STRUCTURE_STORAGE },
    { dx: 0, dy: -2, type: STRUCTURE_ROAD },
    { dx: 1, dy: -2, type: STRUCTURE_ROAD },
    { dx: 2, dy: -1, type: STRUCTURE_ROAD },
    { dx: 2, dy: 0, type: STRUCTURE_ROAD },
    { dx: 1, dy: 1, type: STRUCTURE_ROAD },
    { dx: 0, dy: 2, type: STRUCTURE_ROAD },
    { dx: -1, dy: 2, type: STRUCTURE_ROAD },
    { dx: -2, dy: 1, type: STRUCTURE_ROAD },
    { dx: -2, dy: 0, type: STRUCTURE_ROAD },
    { dx: -1, dy: -1, type: STRUCTURE_ROAD }
  ]
};

export const quickFillPrefab: LayoutPrefab = {
  buildings: [
    { dx: -2, dy: -2, type: STRUCTURE_EXTENSION },
    { dx: -1, dy: -2, type: STRUCTURE_EXTENSION },
    { dx: 0, dy: -2, type: STRUCTURE_SPAWN },
    { dx: 1, dy: -2, type: STRUCTURE_EXTENSION },
    { dx: 2, dy: -2, type: STRUCTURE_EXTENSION },
    { dx: -2, dy: -1, type: STRUCTURE_EXTENSION },
    { dx: 0, dy: -1, type: STRUCTURE_EXTENSION },
    { dx: 2, dy: -1, type: STRUCTURE_EXTENSION },
    { dx: -2, dy: 0, type: STRUCTURE_CONTAINER },
    { dx: -1, dy: 0, type: STRUCTURE_EXTENSION },
    { dx: 0, dy: 0, type: STRUCTURE_LINK },
    { dx: 1, dy: 0, type: STRUCTURE_EXTENSION },
    { dx: 2, dy: 0, type: STRUCTURE_CONTAINER },
    { dx: -2, dy: 1, type: STRUCTURE_EXTENSION },
    { dx: 0, dy: 1, type: STRUCTURE_EXTENSION },
    { dx: 2, dy: 1, type: STRUCTURE_EXTENSION },
    { dx: -2, dy: 2, type: STRUCTURE_EXTENSION },
    { dx: -1, dy: 2, type: STRUCTURE_EXTENSION },
    { dx: 0, dy: 2, type: STRUCTURE_SPAWN },
    { dx: 1, dy: 2, type: STRUCTURE_EXTENSION },
    { dx: 2, dy: 2, type: STRUCTURE_EXTENSION },
    { dx: -2, dy: -3, type: STRUCTURE_ROAD },
    { dx: -1, dy: -3, type: STRUCTURE_ROAD },
    { dx: 0, dy: -3, type: STRUCTURE_ROAD },
    { dx: 1, dy: -3, type: STRUCTURE_ROAD },
    { dx: 2, dy: -3, type: STRUCTURE_ROAD },
    { dx: 3, dy: -2, type: STRUCTURE_ROAD },
    { dx: 3, dy: -1, type: STRUCTURE_ROAD },
    { dx: 3, dy: 0, type: STRUCTURE_ROAD },
    { dx: 3, dy: 1, type: STRUCTURE_ROAD },
    { dx: 3, dy: 2, type: STRUCTURE_ROAD },
    { dx: 2, dy: 3, type: STRUCTURE_ROAD },
    { dx: 1, dy: 3, type: STRUCTURE_ROAD },
    { dx: 0, dy: 3, type: STRUCTURE_ROAD },
    { dx: -1, dy: 3, type: STRUCTURE_ROAD },
    { dx: -2, dy: 3, type: STRUCTURE_ROAD },
    { dx: -3, dy: 2, type: STRUCTURE_ROAD },
    { dx: -3, dy: 1, type: STRUCTURE_ROAD },
    { dx: -3, dy: 0, type: STRUCTURE_ROAD },
    { dx: -3, dy: -1, type: STRUCTURE_ROAD },
    { dx: -3, dy: -2, type: STRUCTURE_ROAD }
  ]
};

export const labArrayPrefab: LayoutPrefab = {
  buildings: [
    { dx: 0, dy: -1, type: STRUCTURE_LAB },
    { dx: 1, dy: -2, type: STRUCTURE_LAB },
    { dx: 2, dy: -1, type: STRUCTURE_LAB },

    { dx: 0, dy: -2, type: STRUCTURE_LAB },
    { dx: 1, dy: -3, type: STRUCTURE_LAB },
    { dx: 2, dy: -3, type: STRUCTURE_LAB },
    { dx: 1, dy: 0, type: STRUCTURE_LAB },
    { dx: 2, dy: 0, type: STRUCTURE_LAB },
    { dx: 3, dy: -1, type: STRUCTURE_LAB },
    { dx: 3, dy: -2, type: STRUCTURE_LAB },

    { dx: 0, dy: 0, type: STRUCTURE_ROAD },
    { dx: 1, dy: -1, type: STRUCTURE_ROAD },
    { dx: 2, dy: -2, type: STRUCTURE_ROAD },
    { dx: 3, dy: -3, type: STRUCTURE_ROAD }
  ]
};
