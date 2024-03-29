import * as C from "../../config/constants";
import * as Config from "../../config/config";
import { getFromCache, saveToCache } from "../../utils/Cache";
import { isOwnedRoom } from "../../utils/RoomCalc";
import { unpackPosition } from "utils/RoomPositionPacker";

export function VisualHandler(room: Room, speed: number): void {
  if (Config.roomVisuals && isOwnedRoom(room)) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: string | null = getFromCache("visualhandlerdata" + room.name, 10 / speed);
    if (data === null) {
      if (room.memory.repair !== undefined) {
        room.visual.text(`Repair Targets: ${Object.values(room.memory.repair).length}`, 1, 1.275, {
          align: "left",
          font: "0.8"
        });
        for (const site of Object.values(room.memory.repair)) {
          const pos = unpackPosition(site.pos);
          const r = Game.rooms[pos.roomName];
          if (r !== undefined) {
            r.visual.circle(pos.x, pos.y, {
              fill: "#ff1111"
            });
          }
        }
      }

      if (Memory.stats?.rooms !== undefined && Memory.stats.rooms[room.name] !== undefined) {
        const { rampartavg, rampartmin, rampartmax } = Memory.stats.rooms[room.name];
        room.visual.text(
          `Rampart Target Hits: ${Math.round(
            (RAMPART_HITS_MAX[room.controller.level] * C.RAMPART_PERCENTAGE_MIN) / 1000
          )}k`,
          1,
          2.275,
          {
            align: "left",
            font: "0.8"
          }
        );

        room.visual.text(
          `Rampart Hits: ${Math.round(rampartavg / 1000)}k/${Math.round(rampartmin / 1000)}k/${Math.round(
            rampartmax / 1000
          )}k (avg/min/max)`,
          1,
          3.275,
          {
            align: "left",
            font: "0.8"
          }
        );
      }

      if (
        room.memory.energySupply !== undefined &&
        room.memory.buildEnergy !== undefined &&
        room.memory.repairEnergy !== undefined
      ) {
        room.visual.text(
          `Energy demand: ${Math.round((room.memory.buildEnergy + room.memory.repairEnergy) / 1000)}k`,
          1,
          4.275,
          {
            align: "left",
            font: "0.8"
          }
        );

        room.visual.text(`Energy supply: ${Math.round(room.memory.energySupply / 1000)}k`, 1, 5.275, {
          align: "left",
          font: "0.8"
        });
      }

      saveToCache("visualhandlerdata" + room.name, room.visual.export());
    } else {
      room.visual.import(data);
    }

    if (room.memory.defenseData !== undefined) {
      for (const hostile of room.memory.defenseData.hostiles) {
        const pos = unpackPosition(hostile.pos);
        room.visual.text(hostile.potentialDamage.toString(), pos, {
          align: "left",
          font: 0.5,
          color: "#ff0000"
        });
        room.visual.text(hostile.potentialHeal.toString(), pos, {
          align: "right",
          font: 0.5,
          color: "#00ff00"
        });
      }
    }
  }
}
