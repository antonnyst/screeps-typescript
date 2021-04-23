declare global {
    interface Memory {
        stats?: Stats;
    }
}

interface Stats {
    time?: number;
    globalReset?: number;
    creeps?: {
        total: number;
        roles: { [key in string]: number };
    };
    cpu?: {
        used: number;
        limit: number;
        bucket: number;
        msplit: { [key in string]: number };
    };
    gcl?: {
        progress: number;
        progressTotal: number;
        level: number;
    };
    rooms?: {
        [key in string]: RoomStats;
    };
    pathfinding?: {
        cacheHits: number;
        totalQueries: number;
    };
    accountResources?: {
        [key in InterShardResourceConstant]: number;
    };
    credits?: number;
    prices?: {
        [key in MarketResourceConstant]?: {
            sell: number;
            buy: number;
        };
    };
}

export function saveInit(): void {
    if (Memory.stats === undefined) {
        Memory.stats = {
            globalReset: Game.time
        };
    } else {
        Memory.stats.globalReset = Game.time;
    }
}

export function saveTick(): void {
    Memory.stats = {
        time: Game.time,
        creeps: {
            total: Object.keys(Game.creeps).length,
            roles: _.countBy(Game.creeps, (c) => c.memory.role)
        },
        cpu: {
            used: 0,
            limit: Game.cpu.limit,
            bucket: Game.cpu.bucket,
            msplit: Memory.msplit
        },
        gcl: {
            level: Game.gcl.level,
            progress: Game.gcl.progress,
            progressTotal: Game.gcl.progressTotal
        },
        rooms: {},
        pathfinding: {
            cacheHits: Memory.cacheHits,
            totalQueries: Memory.totalQueries
        },
        accountResources: {
            token: Game.resources[SUBSCRIPTION_TOKEN],
            cpuUnlock: Game.resources[CPU_UNLOCK],
            pixel: Game.resources[PIXEL],
            accessKey: Game.resources[ACCESS_KEY]
        },
        credits: Game.market.credits,
        prices: Memory.marketData.prices
    };

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            const energystored = (Memory.rooms[roomName].resources !== undefined
                ? Memory.rooms[roomName].resources?.total.energy
                : 0) as number;
            let resources = Memory.rooms[roomName].resources?.total;
            const rampartavg = (Memory.rooms[roomName].rampartData !== undefined
                ? Memory.rooms[roomName].rampartData?.rampartavg
                : 0) as number;
            const rampartmin = (Memory.rooms[roomName].rampartData !== undefined
                ? Memory.rooms[roomName].rampartData?.rampartmin
                : 0) as number;
            const rampartmax = (Memory.rooms[roomName].rampartData !== undefined
                ? Memory.rooms[roomName].rampartData?.rampartmax
                : 0) as number;

            Memory.stats.rooms![roomName] = {
                controller: {
                    level: room.controller.level,
                    progress: room.controller.progress,
                    progressTotal: room.controller.progressTotal
                },
                energystored,
                rampartavg,
                rampartmin,
                rampartmax,
                resources
            };
        }
    }
    Memory.stats.cpu!.used = Game.cpu.getUsed();
}
