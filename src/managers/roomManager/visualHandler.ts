import * as C from "../../config/constants";
import * as Config from "../../config/config";
import { getFromCache, saveToCache } from "../../utils/Cache";

export function VisualHandler(room: Room, speed: number): void {
    if (Config.roomVisuals && room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        let data: string | null = getFromCache("visualhandlerdata" + room.name, 10 / speed);
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
                    Math.round((room.memory.rampartData?.rampartavg || 0) / 1000) +
                    "k/" +
                    Math.round((room.memory.rampartData?.rampartmin || 0) / 1000) +
                    "k/" +
                    Math.round((room.memory.rampartData?.rampartmax || 0) / 1000) +
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
