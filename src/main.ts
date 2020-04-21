import * as Config from "./config/config";
import { runAllManagers } from "./managerRunner";
import { ErrorMapper } from "./utils/ErrorMapper";

const globalStartTick:number = Game.time;

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
  runAllManagers();

  const uTime:number = Game.cpu.getUsed();
  
  if (Memory.cpuAvg === undefined) {
    Memory.cpuAvg = uTime;
  }
  
  Memory.cpuAvg = Memory.cpuAvg*0.99 + uTime*0.01;

  if (Config.cpuLog && Game.time % 10 === 0 ) {
    console.log("CPU : " + Memory.cpuAvg.toFixed(2) + " (" + (Memory.cpuAvg/Object.keys(Game.creeps).length).toFixed(2) + "/c) Bucket : " + Game.cpu.bucket.toFixed(2));
    console.log("Global age : " + (Game.time - globalStartTick));
  }
});