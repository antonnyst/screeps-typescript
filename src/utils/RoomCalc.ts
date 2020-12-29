import { unpackPosition } from "./RoomPositionPacker";

export function roomTotalStoredEnergy(room: Room): number {
    const containers = _.sum(
        room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_CONTAINER }),
        (s: Structure) => (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY)
    );
    const storage = room.storage !== undefined ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;

    const cpos = unpackPosition(room.memory.layout.baseCenter);
    const lpos = new RoomPosition(cpos.x, cpos.y - 1, cpos.roomName);

    const blink = _.filter(
        lpos.lookFor(LOOK_STRUCTURES),
        (s: Structure) => s.structureType === STRUCTURE_LINK
    )[0] as StructureLink;

    const link = blink !== undefined ? (blink.store.getUsedCapacity(RESOURCE_ENERGY) as number) : 0;

    return containers + storage + link;
}

/*
 * Get type of room from name
 *
 * @author engineeryo
 * @co-author warinternal
 *
 */
export function describeRoom(roomName: string): string {
    const array = roomName.match(/\d+/g);

    if (array) {
        const EW = parseInt(array[0]);
        const NS = parseInt(array[1]);
        if (EW % 10 == 0 && NS % 10 == 0) {
            return "highway_portal";
        } else if (EW % 10 == 0 || NS % 10 == 0) {
            return "highway";
        } else if (EW % 5 == 0 && NS % 5 == 0) {
            return "center";
        } else if (Math.abs(5 - (EW % 10)) <= 1 && Math.abs(5 - (NS % 10)) <= 1) {
            return "source_keeper";
        } else {
            return "room";
        }
    }
    return "err";
}
