import { Manager } from "./managers/manager";

import { CreepManager } from "./managers/creepManager";
import { DefenseManager } from "./managers/defenseManager";
import { FlagManager } from "./managers/flagManager";
import { ResourceManager } from "./managers/resourceManager";
import { RoomManager } from "./managers/roomManager";
import { SpawnManager } from "./managers/spawnManager";

const managers: Manager[] = [
    new FlagManager(),
    new RoomManager(),
    new CreepManager(),
    new SpawnManager(),
    new DefenseManager(),
    new ResourceManager()
];

export const runAllManagers = (): void => {
    let i = 0;
    for (const manager of managers) {
        const a = Game.cpu.getUsed();
        manager.run();
        const b = Game.cpu.getUsed() - a;
        console.log(i + " => " + b);
        i++;
    }
};
