export function roomTotalStoredEnergy(room: Room): number {
    const containers = _.sum(
        room.find(FIND_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_CONTAINER }),
        (s: Structure) => (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY)
    );
    const storage = room.storage !== undefined ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;

    return containers + storage;
}

export function isOwnedRoom(room: Room): room is OwnedRoom {
    return room.controller?.my === true;
}

/*
 * Get type of room from name
 *
 * @author engineeryo
 * @co-author warinternal
 *
 */

type RoomDescription = "highway_portal" | "highway" | "center" | "source_keeper" | "room";

export function describeRoom(roomName: string): RoomDescription | null {
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
    return null;
}
