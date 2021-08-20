/**
 * Runs common logic for creep and then the specified role function
 * @param role The role function to run
 * @param creep The creep to not move
 */
export function logic(role: (creep: Creep) => void, creep: Creep): void {
    if (creep.spawning) {
        return;
    }

    checkIdle(creep);

    role(creep);
}

function checkIdle(creep: Creep) {
    if (creep.memory.checkIdle === undefined) {
        creep.memory.checkIdle = {
            idleCount: 0,
            lastPos: creep.pos
        };
    }
    if (
        creep.pos.isEqualTo(
            new RoomPosition(
                creep.memory.checkIdle.lastPos.x,
                creep.memory.checkIdle.lastPos.y,
                creep.memory.checkIdle.lastPos.roomName
            )
        )
    ) {
        creep.memory.checkIdle.idleCount += 1;
    } else {
        creep.memory.checkIdle.idleCount = 0;
    }
    creep.memory.checkIdle.lastPos = creep.pos;
}
