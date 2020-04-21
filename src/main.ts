import * as Config from "./config/config";
import { runAllManagers } from "./managerRunner";
import { ErrorMapper } from "./utils/ErrorMapper";

const globalStartTick:number = Game.time;

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