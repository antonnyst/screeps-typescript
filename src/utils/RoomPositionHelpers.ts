export function offsetPositionByDirection(pos: RoomPosition, dir: DirectionConstant): RoomPosition {
    const delta: { x: number; y: number } = getDeltaFromDirection(dir);
    if (pos.x + delta.x < 0 || pos.x + delta.x > 49 || pos.y + delta.y < 0 || pos.y + delta.y > 49) {
        console.log(
            "invalid resulting pos! x:" + pos.x + delta.x + " y:" + pos.y + delta.y + " roomName:" + pos.roomName
        );
        return pos;
    }
    return new RoomPosition(pos.x + delta.x, pos.y + delta.y, pos.roomName);
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
export function isPositionEdge(pos: RoomPosition) {
    return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}
