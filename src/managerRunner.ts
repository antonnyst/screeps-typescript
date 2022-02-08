import * as Config from "./config/config";
import { Manager } from "./managers/manager";
import { CreepManager } from "./managers/creepManager";
import { DefenseManager } from "./managers/defenseManager";
import { FlagManager } from "./managers/flagManager";
import { OperationManager } from "managers/operationManager";
import { ResourceManager } from "./managers/resourceManager";
import { RoomManager } from "./managers/roomManager";
import { SpawnManager } from "./managers/spawnManager";
import { MapManager } from "./managers/mapManager";
import { MovementManager } from "managers/movementManager";
import { LayoutManager } from "managers/layoutManager";
import { ErrorMapper } from "utils/ErrorMapper";
import { ScoutManager } from "managers/scoutManager";

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
    new LayoutManager()
];

export const runAllManagers = (): void => {
    const globalSpeed = Math.min(Config.bucketTarget, Game.cpu.bucket) / Config.bucketTarget;
    Memory.msplit = {};
    for (let i = 0; i < managers.length; i++) {
        const a = Game.cpu.getUsed();
        const speed = managers[i].minSpeed + (managers[i].maxSpeed - managers[i].minSpeed) * globalSpeed;
        try {
            managers[i].run(speed);
        } catch (error: any) {
            console.log("Error in " + (managers[i] as Object).constructor.name);
            console.log(ErrorMapper.sourceMappedStackTrace(error));
        }
        const b = Game.cpu.getUsed() - a;
        Memory.msplit[(managers[i] as Object).constructor.name] = b;
        if (Config.cpuLog) {
            console.log((managers[i] as Object).constructor.name + " took " + b);
        }
    }
};
