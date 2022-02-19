import { ClaimerMemory } from "creeps/roles";
import { Manager } from "./manager";
import { displayBase } from "../layout/layout";
import { packPosition } from "utils/RoomPositionPacker";
import { isOwnedRoom } from "../utils/ownedRoom";
import { RoomData } from "data/room/room";

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
            const room = Game.rooms[flag.name];
            if (room !== undefined && isOwnedRoom(room)) {
                room.memory.spawnQueue.push({
                    role: "claimer",
                    body: [CLAIM, MOVE],
                    memory: {
                        role: "claimer",
                        home: flag.name,
                        room: flag.pos.roomName
                    } as ClaimerMemory
                });
                room.memory.remoteSupportRooms.push(flag.pos.roomName);
            }
            flag.memory.processed = true;
        }
        //add remote
        if (primaryColor === COLOR_RED && secondaryColor === COLOR_PURPLE) {
            const room = Game.rooms[flag.name];
            if (room !== undefined && isOwnedRoom(room) && room.memory.remotes !== undefined) {
                room.memory.remotes.push(flag.pos.roomName);
            }
            flag.memory.processed = true;
        }
        //show base layout
        if (primaryColor === COLOR_WHITE && secondaryColor === COLOR_WHITE) {
            const room = Game.rooms[flag.pos.roomName];

            let basicRoomData = RoomData(room.name).basicRoomData.get();

            if (basicRoomData === null) {
                RoomData(room.name).basicRoomData.prepare();
            } else if (room !== undefined && isOwnedRoom(room) && room.memory.genLayout !== undefined) {
                displayBase(flag.pos.roomName, basicRoomData, Memory.rooms[flag.pos.roomName].genLayout!);
            }
        }
        // add road to layout
        if (primaryColor === COLOR_GREY && secondaryColor === COLOR_RED) {
            const room = Game.rooms[flag.pos.roomName];
            if (room !== undefined && isOwnedRoom(room) && room.memory.genLayout !== undefined) {
                room.memory.genLayout!.roads.push(packPosition(flag.pos));
            }
            flag.memory.processed = true;
        }
        // unclaim room
        if (primaryColor === COLOR_BLUE && secondaryColor === COLOR_WHITE) {
            const room = Game.rooms[flag.pos.roomName];
            if (room !== undefined && isOwnedRoom(room)) {
                room.memory.unclaim = 1;
            }
            flag.memory.processed = true;
        }
    }
}
