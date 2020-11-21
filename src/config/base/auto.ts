export const autoLabsLayout: BuildInstruction[][] = [
    [],
    [],
    [],
    [
        { x: 2, y: -2, type: STRUCTURE_ROAD },
        { x: 3, y: -3, type: STRUCTURE_ROAD },
        { x: 4, y: -4, type: STRUCTURE_ROAD },
        { x: 5, y: -5, type: STRUCTURE_ROAD },
        { x: 4, y: -1, type: STRUCTURE_ROAD },
        { x: 5, y: -2, type: STRUCTURE_ROAD },
        { x: 6, y: -3, type: STRUCTURE_ROAD },
        { x: 6, y: -4, type: STRUCTURE_ROAD },
        { x: 1, y: -4, type: STRUCTURE_ROAD },
        { x: 2, y: -5, type: STRUCTURE_ROAD },
        { x: 3, y: -6, type: STRUCTURE_ROAD },
        { x: 4, y: -6, type: STRUCTURE_ROAD }
    ],
    [],
    [],
    [
        { x: 3, y: -2, type: STRUCTURE_LAB },
        { x: 4, y: -2, type: STRUCTURE_LAB },
        { x: 4, y: -3, type: STRUCTURE_LAB },
        { x: 3, y: -2, type: STRUCTURE_RAMPART },
        { x: 4, y: -2, type: STRUCTURE_RAMPART },
        { x: 4, y: -3, type: STRUCTURE_RAMPART }
    ],
    [
        { x: 2, y: -3, type: STRUCTURE_LAB },
        { x: 2, y: -4, type: STRUCTURE_LAB },
        { x: 3, y: -4, type: STRUCTURE_LAB },
        { x: 2, y: -3, type: STRUCTURE_RAMPART },
        { x: 2, y: -4, type: STRUCTURE_RAMPART },
        { x: 3, y: -4, type: STRUCTURE_RAMPART }
    ],
    [
        { x: 3, y: -5, type: STRUCTURE_LAB },
        { x: 4, y: -5, type: STRUCTURE_LAB },
        { x: 5, y: -3, type: STRUCTURE_LAB },
        { x: 5, y: -4, type: STRUCTURE_LAB },
        { x: 3, y: -5, type: STRUCTURE_RAMPART },
        { x: 4, y: -5, type: STRUCTURE_RAMPART },
        { x: 5, y: -3, type: STRUCTURE_RAMPART },
        { x: 5, y: -4, type: STRUCTURE_RAMPART },

        { x: 3, y: -1, type: STRUCTURE_NUKER },
        { x: 1, y: -3, type: STRUCTURE_OBSERVER },
        { x: 3, y: -1, type: STRUCTURE_RAMPART },
        { x: 1, y: -3, type: STRUCTURE_RAMPART }
    ]
];
export const autoLabsRotationGuide: { mx: number; my: number }[] = [
    {
        mx: 1,
        my: 1
    },
    {
        mx: 1,
        my: -1
    },
    {
        mx: -1,
        my: -1
    },
    {
        mx: -1,
        my: 1
    }
];

export const autoExtensionNodeCount: number[] = [0, 0, 1, 2, 4, 6, 8, 10, 12];

export const autoExtensionNode: BuildInstruction[] = [
    { x: -1, y: 0, type: STRUCTURE_EXTENSION },
    { x: 1, y: 0, type: STRUCTURE_EXTENSION },
    { x: 0, y: -1, type: STRUCTURE_EXTENSION },
    { x: 0, y: 1, type: STRUCTURE_EXTENSION },
    { x: 0, y: 0, type: STRUCTURE_EXTENSION },
    { x: -2, y: 0, type: STRUCTURE_ROAD },
    { x: -1, y: 1, type: STRUCTURE_ROAD },
    { x: -1, y: -1, type: STRUCTURE_ROAD },
    { x: 0, y: 2, type: STRUCTURE_ROAD },
    { x: 0, y: -2, type: STRUCTURE_ROAD },
    { x: 1, y: 1, type: STRUCTURE_ROAD },
    { x: 1, y: -1, type: STRUCTURE_ROAD },
    { x: 2, y: 0, type: STRUCTURE_ROAD }
];
export const autoExtensionSpawnNode: BuildInstruction[] = [
    { x: -1, y: 0, type: STRUCTURE_EXTENSION },
    { x: 1, y: 0, type: STRUCTURE_EXTENSION },
    { x: 0, y: -1, type: STRUCTURE_EXTENSION },
    { x: 0, y: 1, type: STRUCTURE_EXTENSION },
    { x: 0, y: 0, type: STRUCTURE_SPAWN, name: "_rn_-_i_" },
    { x: 0, y: 0, type: STRUCTURE_RAMPART },
    { x: -2, y: 0, type: STRUCTURE_ROAD },
    { x: -1, y: 1, type: STRUCTURE_ROAD },
    { x: -1, y: -1, type: STRUCTURE_ROAD },
    { x: 0, y: 2, type: STRUCTURE_ROAD },
    { x: 0, y: -2, type: STRUCTURE_ROAD },
    { x: 1, y: 1, type: STRUCTURE_ROAD },
    { x: 1, y: -1, type: STRUCTURE_ROAD },
    { x: 2, y: 0, type: STRUCTURE_ROAD }
];
