import { ClaimerMemory } from "creeps/roles";
import { Manager } from "./manager";
import { displayBase } from "../layout/layout";
import { packPosition } from "utils/RoomPositionPacker";

declare global {
    interface FlagMemory {
        processed?: boolean;
    }
}

export class FlagManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        for (const flag in Game.flags) {
            HandleFlag(Game.flags[flag]);
        }

        for (const flag in Memory.flags) {
            if (!Game.flags[flag]) {
                delete Memory.flags[flag];
            }
        }
    }
}

function HandleFlag(flag: Flag): void {
    const primaryColor: ColorConstant = flag.color;
    const secondaryColor: ColorConstant = flag.secondaryColor;

    if (flag.memory.processed === true) {
        flag.remove();
    } else {
        //claim controller
        if (primaryColor === COLOR_RED && secondaryColor === COLOR_RED) {
            if (Memory.rooms[flag.name] !== undefined && Memory.rooms[flag.name].roomLevel === 2) {
                Memory.rooms[flag.name].spawnQueue.push({
                    role: "claimer",
                    body: [CLAIM, MOVE],
                    memory: {
                        role: "claimer",
                        home: flag.name,
                        room: flag.pos.roomName
                    } as ClaimerMemory
                });
                Memory.rooms[flag.name].remoteSupportRooms.push(flag.pos.roomName);
            }
            flag.memory.processed = true;
        }
        //add remote
        if (primaryColor === COLOR_RED && secondaryColor === COLOR_PURPLE) {
            if (
                Memory.rooms[flag.name] !== undefined &&
                Memory.rooms[flag.name].roomLevel === 2 &&
                Memory.rooms[flag.name].remotes !== undefined
            ) {
                Memory.rooms[flag.name].remotes.push(flag.pos.roomName);
            }
            flag.memory.processed = true;
        }
        //show base layout
        if (primaryColor === COLOR_WHITE && secondaryColor === COLOR_WHITE) {
            if (
                Memory.rooms[flag.pos.roomName] !== undefined &&
                Memory.rooms[flag.pos.roomName].roomLevel === 2 &&
                Memory.rooms[flag.pos.roomName].basicRoomData !== undefined &&
                Memory.rooms[flag.pos.roomName].genLayout !== undefined
            ) {
                displayBase(
                    flag.pos.roomName,
                    Memory.rooms[flag.pos.roomName].basicRoomData!,
                    Memory.rooms[flag.pos.roomName].genLayout!
                );
            }
        }
        // add road to layout
        if (primaryColor === COLOR_GREY && secondaryColor === COLOR_RED) {
            if (
                Memory.rooms[flag.pos.roomName] !== undefined &&
                Memory.rooms[flag.pos.roomName].roomLevel === 2 &&
                Memory.rooms[flag.pos.roomName].genLayout !== undefined
            ) {
                Memory.rooms[flag.pos.roomName].genLayout!.roads.push(packPosition(flag.pos));
            }
            flag.memory.processed = true;
        }
        // unclaim room
        if (primaryColor === COLOR_BLUE && secondaryColor === COLOR_WHITE) {
            if (Memory.rooms[flag.pos.roomName] !== undefined && Memory.rooms[flag.pos.roomName].roomLevel === 2) {
                Memory.rooms[flag.pos.roomName].unclaim = 1;
            }
            flag.memory.processed = true;
        }
    }
}
