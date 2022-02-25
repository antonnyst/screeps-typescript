import { BasicRoomData, GenLayoutData } from "layout/layout";
import { AddWork } from "managers/layoutManager";
import { packPosition } from "utils/RoomPositionPacker";

declare global {
  namespace NodeJS {
    interface Global {
      addWork: (room: string, controller: number[], source1: number[], source2: number[], mineral: number[]) => void;
    }
  }
}

global.addWork = (room: string, controller: number[], source1: number[], source2: number[], mineral: number[]) => {
  if (Memory.rooms === undefined) {
    Memory.rooms = {};
  }
  Memory.rooms[room] = Memory.rooms[room] || {};
  const data: BasicRoomData = {
    controller: packPosition(new RoomPosition(controller[0], controller[1], room)),
    mineral: {
      pos: packPosition(new RoomPosition(mineral[0], mineral[1], room)),
      id: "a" as Id<Mineral>
    },
    sources: [
      {
        pos: packPosition(new RoomPosition(source1[0], source1[1], room)),
        id: "a" as Id<Source>
      },
      {
        pos: packPosition(new RoomPosition(source2[0], source2[1], room)),
        id: "a" as Id<Source>
      }
    ]
  };
  AddWork({
    room,
    basicRoomData: data,
    callback: (layout: GenLayoutData) => {
      Memory.rooms[room].genLayout = layout;
      console.log(new RoomPosition(layout.prefabs[0].x - 1, layout.prefabs[0].y + 1, room));
    }
  });
};
