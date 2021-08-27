import MemHack from "./utils/MemHack";
import * as Config from "./config/config";
import { runAllManagers } from "./managerRunner";
import { ErrorMapper } from "./utils/ErrorMapper";
import { RunEvery } from "./utils/RunEvery";
import { saveInit, saveRooms, saveTick } from "stats/stats";

declare global {
    interface Memory {
        cpuAvg: number;
    }
}

Memory.cpuAvg = Memory.cpuAvg ?? 0;

saveInit();

export const loop = ErrorMapper.wrapLoop(() => {
    MemHack.pretick();
    if (
        Config.burnForPixels &&
        Game.shard.name === "shard3" &&
        Memory.cpuAvg &&
        Memory.cpuAvg < Game.cpu.limit &&
        Game.cpu.bucket >= PIXEL_CPU_COST
    ) {
        Game.cpu.generatePixel();
    }

    runAllManagers();

    const uTime: number = Game.cpu.getUsed();

    const globalStartTick = Memory.stats?.globalReset || Game.time;

    const age = Game.time - globalStartTick + 1;

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

    if (Game.time % 10 === 0) {
        saveRooms();
    }
    saveTick();
});
