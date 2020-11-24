export const baseCenterLayout: BuildInstruction[][] = [
    [],
    [{ x: 0, y: 0, type: STRUCTURE_SPAWN, name: "{ROOM_NAME}-{INDEX}" }],
    [{ x: 0, y: 0, type: STRUCTURE_RAMPART }],
    [
        { x: -1, y: 0, type: STRUCTURE_TOWER },
        { x: -1, y: 0, type: STRUCTURE_RAMPART },
        { x: 0, y: 1, type: STRUCTURE_ROAD },
        { x: 0, y: 3, type: STRUCTURE_ROAD },
        { x: 0, y: -3, type: STRUCTURE_ROAD },
        { x: -1, y: 2, type: STRUCTURE_ROAD },
        { x: -2, y: 1, type: STRUCTURE_ROAD },
        { x: -3, y: 0, type: STRUCTURE_ROAD },
        { x: -2, y: -1, type: STRUCTURE_ROAD },
        { x: -1, y: -2, type: STRUCTURE_ROAD },
        { x: 1, y: 2, type: STRUCTURE_ROAD },
        { x: 2, y: 1, type: STRUCTURE_ROAD },
        { x: 3, y: 0, type: STRUCTURE_ROAD },
        { x: 2, y: -1, type: STRUCTURE_ROAD },
        { x: 1, y: -2, type: STRUCTURE_ROAD }
    ],
    [
        { x: 0, y: -2, type: STRUCTURE_STORAGE },
        { x: 0, y: -2, type: STRUCTURE_RAMPART }
    ],
    [
        { x: 1, y: 0, type: STRUCTURE_TOWER },
        { x: 1, y: 0, type: STRUCTURE_RAMPART },
        { x: 0, y: -1, type: STRUCTURE_LINK },
        { x: 0, y: -1, type: STRUCTURE_RAMPART }
    ],
    [
        { x: 0, y: 2, type: STRUCTURE_TERMINAL },
        { x: 0, y: 2, type: STRUCTURE_RAMPART }
    ],
    [
        { x: 1, y: -1, type: STRUCTURE_TOWER },
        { x: 1, y: -1, type: STRUCTURE_RAMPART },
        { x: 2, y: 0, type: STRUCTURE_FACTORY },
        { x: 2, y: 0, type: STRUCTURE_RAMPART }
    ],
    [
        { x: -1, y: -1, type: STRUCTURE_TOWER },
        { x: -1, y: 1, type: STRUCTURE_TOWER },
        { x: 1, y: 1, type: STRUCTURE_TOWER },
        { x: -1, y: -1, type: STRUCTURE_RAMPART },
        { x: -1, y: 1, type: STRUCTURE_RAMPART },
        { x: 1, y: 1, type: STRUCTURE_RAMPART },

        { x: -2, y: 0, type: STRUCTURE_POWER_SPAWN },
        { x: -2, y: 0, type: STRUCTURE_RAMPART }
    ]
];
