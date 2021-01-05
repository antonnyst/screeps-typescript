import { Manager } from "./manager";
export class FlagManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        for (const flag in Game.flags) {
            HandleFlag(Game.flags[flag]);
        }
    }
}

function HandleFlag(flag: Flag): void {
    const primaryColor: ColorConstant = flag.color;
    const secondaryColor: ColorConstant = flag.secondaryColor;

    if (flag.room === undefined) {
        return;
    }

    if (primaryColor === COLOR_RED && secondaryColor === COLOR_RED) {
        flag.remove();
    }
}
