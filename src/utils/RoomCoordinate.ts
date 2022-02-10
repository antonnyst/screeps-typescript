interface RoomCoordinate {
    x: number;
    y: number;
}

export function toRoomCoordinate(room: string): RoomCoordinate | null {
    const match = room.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
    if (match !== null) {
        let [, h, rx, v, ry] = match;
        let x = Number.parseInt(rx, 10);
        let y = Number.parseInt(ry, 10);
        if (h == "W") {
            x = ~x;
        }
        if (v == "N") {
            y = ~y;
        }
        return {
            x,
            y
        };
    }
    return null;
}

export function fromRoomCoordinate(coordinate: RoomCoordinate): string | null {
    let roomName =
        (coordinate.x < 0 ? "W" + ~coordinate.x : "E" + coordinate.x) +
        (coordinate.y < 0 ? "N" + ~coordinate.y : "S" + coordinate.y);

    if (Game.map.getRoomStatus(roomName) == null) {
        return null;
    }
    return roomName;
}
