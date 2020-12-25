import { RoomManager } from "managers/roomManager";
import { RunEvery } from "utils/RunEvery";
import * as C from "../../config/constants";
import * as Config from "../../config/config";
import { getFromCache, saveToCache } from "../../utils/Cache";

export function VisualHandler(room: Room): void {
    if (Config.roomVisuals && room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        let data: string | null = getFromCache("visualhandlerdata" + room.name, 10);
        if (data === null) {
            room.visual.text("Repair Targets: " + Object.values(room.memory.repairTargets).length, 1, 1.275, {
                align: "left",
                font: "0.8"
            });
            for (const site of Object.values(room.memory.repairTargets)) {
                if (site.roomName === room.name) {
                    room.visual.circle(site.x, site.y, {
                        fill: "#ff1111"
                    });
                }
            }
            const ramparts = room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_RAMPART });

            let sum = 0;

            let hitsMax = 0;
            let hitsMin = Infinity;

            for (const rampart of ramparts) {
                if (hitsMax < rampart.hits) {
                    hitsMax = rampart.hits;
                }
                if (hitsMin > rampart.hits) {
                    hitsMin = rampart.hits;
                }
                sum += rampart.hits;
            }

            room.visual.text(
                "Rampart Health Target: " +
                    Math.round((RAMPART_HITS_MAX[room.controller.level] * C.RAMPART_PERCENTAGE_MIN) / 1000) +
                    "k",
                1,
                2.275,
                {
                    align: "left",
                    font: "0.8"
                }
            );

            room.visual.text(
                "Rampart Health: " +
                    Math.round(sum / ramparts.length / 1000) +
                    "k/" +
                    Math.round(hitsMin / 1000) +
                    "k/" +
                    Math.round(hitsMax / 1000) +
                    "k (avg/min/max)",
                1,
                3.275,
                {
                    align: "left",
                    font: "0.8"
                }
            );

            saveToCache("visualhandlerdata" + room.name, room.visual.export());
        } else {
            room.visual.import(data);
        }
    }
}
