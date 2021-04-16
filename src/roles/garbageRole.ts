import { CreepRole } from "./creepRole";

// The creep is garbage so it should recycle itself
// The implementation is garbage so the creep just idles

export class GarbageRole extends CreepRole {
    runRole() {
        if (
            this.creep === null ||
            this.creep.memory.roleData === undefined ||
            this.creep.memory.roleData.target === undefined
        ) {
            return;
        }

        this.setMovementData(this.creep.pos, 5, false, false);
    }
}
