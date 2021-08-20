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

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definition alone.
          You must also give them an implementation if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
  }

  interface CreepMemory {
    role: string;
    room: string;
    working: boolean;
  }

}
// Syntax for adding properties to `global` (ex "global.log")
declare const global: {
  log: any;
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
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

    if (Game.time % 50 === 0) {
        saveRooms();
    }
    saveTick();
});
