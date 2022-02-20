import { Manager } from "./manager";
import { getFromCache, saveToCache } from "../utils/Cache";
import * as Config from "../config/config";
import { RoomData } from "data/room/room";

export class MapManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        if (Game.shard.name !== "shard3") {
            return;
        }
        if (Config.mapVisuals && Memory.mapRooms !== undefined) {
            const visualString: string | undefined = getFromCache("mapCache", 100 / speed);
            if (visualString === undefined || visualString === null) {
                const rooms = Memory.mapRooms.split(",");
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

const colors = ["#ff0000", "#ff0000", "#ffffff", "#00ff00", "#00ff00"];
const opacity = [0.5, 0.25, 0, 0.25, 0.5];
const size = 30;

function perRoom(room: string) {
    const control = RoomData(room).control.get();
    const x = (50 - size) / 2;
    const y = (50 - size) / 2;
    if (control !== null) {
        const tl: RoomPosition = new RoomPosition(x, y, room);

        Game.map.visual.rect(tl, size, size, {
            fill: colors[control + 2],
            opacity: opacity[control + 2]
        });
        const text: string = "A: " + (Game.time - (RoomData(room).lastUpdate.get() ?? 0));
        Game.map.visual.text(text, new RoomPosition(2, 4, room), {
            fontSize: 6,
            align: "left"
        });
    }
}
