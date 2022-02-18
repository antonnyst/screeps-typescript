import { BasicRoomData } from "layout/layout";
import { HostileData } from "./room";

type IdPosPair<T> = [Id<T>, number];
type MineralPair = IdPosPair<Mineral>;
type SourcePair = IdPosPair<Source>;
type CompactBasicRoomData = [number | null, SourcePair[], MineralPair | null];

let RoomDataPacking = {
    control: {
        pack: (data: number): string => {
            return data.toString();
        },
        unpack: (data: string): number => {
            return parseInt(data);
        }
    },
    lastUpdate: {
        pack: (data: number): string => {
            return data.toString(16);
        },
        unpack: (data: string): number => {
            return parseInt(data, 16);
        }
    },
    basicRoomData: {
        pack: (data: BasicRoomData): string => {
            let arr: CompactBasicRoomData = [
                data.controller,
                data.sources.map((s) => [s.id, s.pos]),
                data.mineral === null ? null : [data.mineral.id, data.mineral.pos]
            ];
            return JSON.stringify(arr);
        },
        unpack: (data: string): BasicRoomData => {
            let arr: CompactBasicRoomData = JSON.parse(data);
            let basicRoomData: BasicRoomData = {
                controller: arr[0],
                sources: arr[1].map((sp) => {
                    return {
                        id: sp[0],
                        pos: sp[1]
                    };
                }),
                mineral: arr[2] === null ? null : { id: arr[2][0], pos: arr[2][1] }
            };
            return basicRoomData;
        }
    },
    hostiles: {
        pack: (data: HostileData[]): string => {
            return JSON.stringify(data);
        },
        unpack: (data: string): HostileData[] => {
            return JSON.parse(data) as HostileData[];
        }
    },
    reservation: {
        pack: (data: ReservationDefinition): string => {
            return JSON.stringify(data);
        },
        unpack: (data: string): ReservationDefinition => {
            return JSON.parse(data) as ReservationDefinition;
        }
    }
};

export { RoomDataPacking };
