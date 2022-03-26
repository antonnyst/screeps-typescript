import { RoomData } from "data/room/room";
import { describeRoom } from "utils/RoomCalc";

export function findRoute(
  from: string,
  to: string
):
  | -2
  | {
      exit: ExitConstant;
      room: string;
    }[] {
  return Game.map.findRoute(from, to, {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    routeCallback: (roomName, _fromRoomName) => {
      if (RoomData(roomName).control.get() === -2) {
        return 25;
      }
      if (RoomData(roomName).control.get() === -1) {
        return 5;
      }
      if (describeRoom(roomName) === "source_keeper") {
        return 5;
      }
      const h = RoomData(roomName).hostiles.get();
      if (h !== null && h.length > 0) {
        return 2;
      }
      return 1;
    }
  });
}
