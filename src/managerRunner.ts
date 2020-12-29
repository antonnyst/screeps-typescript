import * as Config from "./config/config";
import { Manager } from "./managers/manager";
import { CreepManager } from "./managers/creepManager";
import { DefenseManager } from "./managers/defenseManager";
import { FlagManager } from "./managers/flagManager";
import { ResourceManager } from "./managers/resourceManager";
import { RoomManager } from "./managers/roomManager";
import { SpawnManager } from "./managers/spawnManager";
import { MapManager } from "./managers/mapManager";
import { MovementManager } from "managers/movementManager";

const managers: Manager[] = [
    new FlagManager(),
    new RoomManager(),
    new CreepManager(),
    new MovementManager(),
    new SpawnManager(),
    new DefenseManager(),
    new ResourceManager(),
    new MapManager()
];

export const runAllManagers = (): void => {
    let i = 0;
    for (const manager of managers) {
        const a = Game.cpu.getUsed();
        manager.run();
        const b = Game.cpu.getUsed() - a;

        if (Config.cpuLog) {
            console.log(i + " => " + b);
        }
        i++;
    }
};
