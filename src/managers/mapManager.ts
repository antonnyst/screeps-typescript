import { Manager } from "./manager";
import { getFromCache, saveToCache } from "../utils/Cache";

export class MapManager implements Manager {
    public run() {
        const visualString: string | undefined = getFromCache("mapCache", 100);
        if (visualString === undefined || visualString === null) {
            for (const room in Memory.rooms) {
                perRoom(room);
            }
            saveToCache("mapCache", Game.map.visual.export());
        } else {
            Game.map.visual.import(visualString);
        }
    }
}

const colors = ["#ff1111", "#aa1111", "#555511", "#11aa11", "#11ff11"];

function perRoom(room: string) {
    const tl: RoomPosition = new RoomPosition(1, 1, room);

    if (Memory.rooms[room].lastUpdate === undefined) {
        Memory.rooms[room].lastUpdate = 0;
    }

    const roomNumber: number = Memory.rooms[room].roomLevel;
    if (roomNumber !== undefined) {
        Game.map.visual.rect(tl, 48, 48, {
            fill: colors[roomNumber + 2]
        });
        Game.map.visual.text("A: " + (Game.time - Memory.rooms[room].lastUpdate), new RoomPosition(2, 4, room), {
            fontSize: 6,
            align: "left"
        });
    }
}
