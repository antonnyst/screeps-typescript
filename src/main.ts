import * as Config from "./config/config";
import { runAllManagers } from "./managerRunner";
import { ErrorMapper } from "./utils/ErrorMapper";

const globalStartTick: number = Game.time;

export const loop = ErrorMapper.wrapLoop(() => {
    runAllManagers();

    const uTime: number = Game.cpu.getUsed();

    if (Memory.cpuAvg === undefined) {
        Memory.cpuAvg = uTime;
    }

    Memory.cpuAvg = Memory.cpuAvg * 0.95 + uTime * 0.05;

    if (Game.time % 10 === 0) {
        if (
            Config.burnForPixels &&
            Game.shard.name === "shard3" && //Hardcode please fix
            Memory.cpuAvg < Game.cpu.limit &&
            Game.cpu.bucket > 9000
        ) {
            Game.cpu.generatePixel();
        }

        if (Config.mainLog) {
            console.log(
                `CPU : ${Memory.cpuAvg.toFixed(2)} (${(Memory.cpuAvg / Object.keys(Game.creeps).length).toFixed(
                    2
                )}/c) Bucket : ${Game.cpu.bucket.toFixed(2)}`
            );
            console.log("Global age : " + (Game.time - globalStartTick));
        }
    }
    if (Config.cpuLog) console.log("t => " + Game.cpu.getUsed());
});
