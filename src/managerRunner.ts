import * as Config from "./config/config";
import { CreepManager } from "./managers/creepManager";
import { DataManager } from "managers/dataManager";
import { DefenseManager } from "./managers/defenseManager";
import { ErrorMapper } from "utils/ErrorMapper";
import { FlagManager } from "./managers/flagManager";
import { LayoutManager } from "managers/layoutManager";
import { Manager } from "./managers/manager";
import { MapManager } from "./managers/mapManager";
import { MovementManager } from "managers/movementManager";
import { OperationManager } from "managers/operationManager";
import { ResourceManager } from "./managers/resourceManager";
import { RoomManager } from "./managers/roomManager";
import { ScoutManager } from "managers/scoutManager";
import { SpawnManager } from "./managers/spawnManager";

declare global {
  interface Memory {
    msplit: { [key in string]: number };
  }
}

const managers: Manager[] = [
  new FlagManager(),
  new RoomManager(),
  new CreepManager(),
  new DefenseManager(),
  new MovementManager(),
  new SpawnManager(),
  new ResourceManager(),
  new MapManager(),
  new OperationManager(),
  new ScoutManager(),
  new LayoutManager(),
  new DataManager()
];

export const runAllManagers = (): void => {
  const globalSpeed = Math.min(Config.bucketTarget, Game.cpu.bucket) / Config.bucketTarget;
  Memory.msplit = {};
  for (const manager of managers) {
    const a = Game.cpu.getUsed();
    const speed = manager.minSpeed + (manager.maxSpeed - manager.minSpeed) * globalSpeed;
    try {
      manager.run(speed);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/ban-types
      console.log("Error in " + (manager as Object).constructor.name);
      console.log(ErrorMapper.sourceMappedStackTrace(error as string | Error));
    }
    const b = Game.cpu.getUsed() - a;
    // eslint-disable-next-line @typescript-eslint/ban-types
    Memory.msplit[(manager as Object).constructor.name] = b;
    if (Config.cpuLog) {
      // eslint-disable-next-line @typescript-eslint/ban-types
      console.log(`${(manager as Object).constructor.name} took ${b}`);
    }
  }
};
