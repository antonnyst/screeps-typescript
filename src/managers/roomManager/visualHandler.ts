import { RunEvery } from "utils/RunEvery";
import * as Config from "../../config/config";
import { getFromCache, saveToCache } from "../../utils/Cache";

export function VisualHandler(room: Room): void {
    if (Config.roomVisuals && room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        let data: string | null = getFromCache("visualhandlerdata" + room.name, 10);
        if (data === null) {
            room.visual.text("rt:" + Object.values(room.memory.repairTargets).length, 1, 1);
            for (const site of Object.values(room.memory.repairTargets)) {
                if (site.roomName === room.name) {
                    room.visual.circle(site.x, site.y, {
                        fill: "#ff1111"
                    });
                }
            }
            saveToCache("visualhandlerdata" + room.name, room.visual.export());
        } else {
            room.visual.import(data);
        }
    }
}
