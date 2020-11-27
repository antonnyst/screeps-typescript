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
        Game.cpu.bucket > 9000
    ) {
        Game.cpu.generatePixel();
        // return;
    }

    runAllManagers();

    const uTime: number = Game.cpu.getUsed();

    if (Memory.cpuAvg === undefined) {
        Memory.cpuAvg = uTime;
    }

    Memory.cpuAvg = Memory.cpuAvg * 0.95 + uTime * 0.05;

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
});
