import { DataInterface } from "../interface";
import { RoomDataPacking } from "./pack";

export interface HostileData {
  id: string;
  pos: RoomPosition;
  body: BodyPartDefinition[];
  firstSeen: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const RoomData = (room: string) => {
  return {
    control: DataInterface(room + ".c", RoomDataPacking.control, "heap"),
    lastUpdate: DataInterface(room + ".lU", RoomDataPacking.lastUpdate, "heap"),
    basicRoomData: DataInterface(room + ".bRD", RoomDataPacking.basicRoomData, "segment"),
    hostiles: DataInterface(room + ".h", RoomDataPacking.hostiles, "heap"),
    reservation: DataInterface(room + ".r", RoomDataPacking.reservation, "heap")
  };
};

export { RoomData };
