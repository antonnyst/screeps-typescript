import { RoomData } from "data/room/room";
import { unpackPosition } from "utils/RoomPositionPacker";
import { RunEvery, RunNow } from "utils/RunEvery";

declare global {
    interface RoomMemory {
        remoteData?: RemoteData;
    }
}

interface RemoteData {
    data: { [roomName in string]: RemoteRoomData };
    check: string;
}

interface RemoteRoomData {
    sources: RemoteSourceData[];
}

interface RemoteSourceData {
    id: Id<Source>;
    pos: number;
    dist: number;
    container: DirectionConstant;
    haulers: RemoteHaulerData;
}

interface RemoteHaulerData {
    amountNeeded: number;
    size: number;
}

// The RemoteHandler should update the remoteData deciding on container positions and hauler needs

export function RemoteHandler(room: OwnedRoom): void {
    if (room.memory.remotes === undefined) {
        room.memory.remotes = [];
    }

    if (room.memory.remoteData === undefined || room.memory.remoteData.check !== GetRemoteChecksum(room)) {
        RunNow(() => {
            let data = GenerateRemoteData(room);
            if (data !== null) {
                room.memory.remoteData = data;
            }
        }, "remotehandlergenerateremotedata" + room.name);
    }

    RunEvery(
        () => {
            let data = GenerateRemoteData(room);
            if (data !== null) {
                room.memory.remoteData = data;
            }
        },
        "remotehandlergenerateremotedata" + room.name,
        100
    );
}

function GetRemoteChecksum(room: OwnedRoom): string {
    let res = "" + room.controller!.level;
    for (const remote of room.memory.remotes) {
        res += remote;
    }
    return res;
}

function GenerateRemoteData(room: OwnedRoom): RemoteData | null {
    const data: { [roomName in string]: RemoteRoomData } = {};
    for (const remote of room.memory.remotes) {
        const res = GenerateRemoteRoomData(room.name, remote);
        if (res === undefined) {
            return null;
        }
        data[remote] = res;
    }

    return {
        data,
        check: GetRemoteChecksum(room)
    };
}

function GenerateRemoteRoomData(baseRoom: string, remoteRoom: string): RemoteRoomData | undefined {
    const basicRoomData = RoomData(remoteRoom).basicRoomData.get();
    if (basicRoomData === null) {
        RoomData(remoteRoom).basicRoomData.prepare();
        return undefined;
    }
    if (Memory.rooms[baseRoom]?.genLayout === undefined) {
        return undefined;
    }

    const sources: RemoteSourceData[] = [];

    const basePos = new RoomPosition(
        Memory.rooms[baseRoom].genLayout!.prefabs[0].x,
        Memory.rooms[baseRoom].genLayout!.prefabs[0].y,
        baseRoom
    );

    for (const source of basicRoomData.sources) {
        const pos: number = source.pos;
        const id: Id<Source> = source.id;

        const search = PathFinder.search(basePos, {
            pos: unpackPosition(pos),
            range: 1
        });

        if (search.incomplete === true) {
            return undefined;
        }

        const dist: number = search.path.length - 1;
        const container: DirectionConstant = unpackPosition(source.pos).getDirectionTo(
            search.path[search.path.length - 1]
        );

        const tdist = dist * 2;
        const capacityNeeded = (SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME) * tdist;
        const carryNeeded = capacityNeeded / 50;
        const maxCarry = Math.min(Math.floor(Game.rooms[baseRoom].energyCapacityAvailable / 75), 33);

        const creepsNeeded = Math.ceil(carryNeeded / maxCarry);
        const patternValue = Math.ceil(carryNeeded / creepsNeeded / 2) + 1;

        const haulers: RemoteHaulerData = {
            amountNeeded: creepsNeeded,
            size: patternValue
        };

        sources.push({
            pos,
            id,
            dist,
            container,
            haulers
        });
    }
    if (sources.length === 0) {
        return undefined;
    }

    return {
        sources
    };
}
