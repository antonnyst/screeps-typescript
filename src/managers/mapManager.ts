import { Manager } from "./manager";
import { getFromCache, saveToCache } from "../utils/Cache";
import * as Config from "../config/config";
import { RoomData } from "data/room/room";

export class MapManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        if (Config.mapVisuals && Memory.mapRooms !== undefined) {
            const visualString: string | undefined = getFromCache("mapCache", 100 / speed);
            if (visualString === undefined || visualString === null) {
                let rooms = Memory.mapRooms.split(",");
                for (const room of rooms) {
                    perRoom(room);
                }
                saveToCache("mapCache", Game.map.visual.export());
            } else {
                Game.map.visual.import(visualString);
            }
        }
    }
}

const colors = ["#ff1111", "#aa1111", "#555511", "#11aa11", "#11ff11"];

function perRoom(room: string) {
    const tl: RoomPosition = new RoomPosition(1, 1, room);

    const roomNumber = RoomData(room).control.get();
    if (roomNumber !== null) {
        Game.map.visual.rect(tl, 48, 48, {
            fill: colors[roomNumber + 2]
        });
        const text: string = "A: " + (Game.time - (RoomData(room).lastUpdate.get() ?? 0));
        Game.map.visual.text(text, new RoomPosition(2, 4, room), {
            fontSize: 6,
            align: "left"
        });
    }
}
