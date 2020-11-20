export function offsetPositionByDirection(pos: RoomPosition, dir: DirectionConstant): RoomPosition {
    const delta: { x: number; y: number } = getDeltaFromDirection(dir);

    const newPos = new RoomPosition(pos.x + delta.x, pos.y + delta.y, pos.roomName);

    if (newPos.x < 0 || newPos.x > 49 || newPos.y < 0 || newPos.y > 49) {
        console.log("invalid resulting pos!");

        return pos;
    }

    return newPos;
}

function getDeltaFromDirection(direction: DirectionConstant): { x: number; y: number } {
    switch (direction) {
        case TOP_RIGHT:
            return { x: 1, y: -1 };
        case RIGHT:
            return { x: 1, y: 0 };
        case BOTTOM_RIGHT:
            return { x: 1, y: 1 };
        case BOTTOM:
            return { x: 0, y: 1 };
        case BOTTOM_LEFT:
            return { x: -1, y: 1 };
        case LEFT:
            return { x: -1, y: 0 };
        case TOP_LEFT:
            return { x: -1, y: -1 };
        case TOP:
            return { x: 0, y: -1 };
        default:
            console.log("invalid direction");
            return { x: 0, y: 0 };
    }
}
