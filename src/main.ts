import MemHack from "./utils/MemHack";
import * as Config from "./config/config";
import { runAllManagers } from "./managerRunner";
import { ErrorMapper } from "./utils/ErrorMapper";
import { RunEvery } from "./utils/RunEvery";

const globalStartTick: number = Game.time;

export const loop = ErrorMapper.wrapLoop(() => {
    MemHack.pretick();
    if (
        Config.burnForPixels &&
        Game.shard.name === "shard3" &&
        Memory.cpuAvg < Game.cpu.limit &&
        Game.cpu.bucket >= PIXEL_CPU_COST
    ) {
        Game.cpu.generatePixel();
    }

    runAllManagers();

    const uTime: number = Game.cpu.getUsed();

    const age = Game.time - globalStartTick + 1;

    if (Memory.cpuAvg === undefined) {
        Memory.cpuAvg = 0;
    }

    Memory.cpuAvg = Memory.cpuAvg + (uTime - Memory.cpuAvg) / Math.min(age, 250);

    if (Config.mainLog) {
        RunEvery(
            () => {
                console.log(
                    `CPU : ${Memory.cpuAvg.toFixed(2)} (${(Memory.cpuAvg / Object.keys(Game.creeps).length).toFixed(
                        2
                    )}/c) Bucket : ${Game.cpu.bucket.toFixed(2)}`
                );
                console.log("Global age : " + (Game.time - globalStartTick));
            },
            "cpumainlog",
            10
        );
    }
    if (Config.cpuLog) console.log("t => " + Game.cpu.getUsed());

    Memory.stats = {
        time: Game.time,
        globalReset: globalStartTick,
        creeps: Object.keys(Game.creeps).length,
        cpu: {
            used: uTime,
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

            Memory.stats.rooms[roomName] = {
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
    Memory.stats.cpu.used = Game.cpu.getUsed();
});
