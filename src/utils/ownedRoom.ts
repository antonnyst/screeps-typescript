export function isOwnedRoom(room: Room): room is OwnedRoom {
    return room.controller?.my === true;
}
