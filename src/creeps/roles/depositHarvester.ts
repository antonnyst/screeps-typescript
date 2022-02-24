import { Storage } from "buildings";
import { unpackPosition } from "utils/RoomPositionPacker";
import { setMovementData } from "../creep";

export interface DepositHarvesterMemory extends CreepMemory {
    id: Id<Deposit>;
    gathering?: boolean;
    distance?: number;
}

const RETURN_MARGIN = 25;

export function depositHarvester(creep: Creep): void {
    const memory = creep.memory as DepositHarvesterMemory;
    const home = Game.rooms[creep.memory.home];

    if (Memory.deposits === undefined) {
        return;
    }
    const pos = unpackPosition(Memory.deposits[memory.id].pos);

    memory.gathering = memory.gathering ?? true;

    if (memory.gathering) {
        setMovementData(creep, { pos, range: 1 });
        if (creep.pos.isNearTo(pos)) {
            if (memory.distance === undefined) {
                memory.distance = PathFinder.search(creep.pos, {
                    pos: new RoomPosition(25, 25, home.name),
                    range: 5
                }).path.length;
            }

            if (creep.store.getFreeCapacity() === 0) {
                memory.gathering = false;
            }

            const deposit = Game.getObjectById(memory.id);
            if (deposit !== null) {
                if (deposit.cooldown === 0) {
                    creep.harvest(deposit);
                } else if (creep.ticksToLive! - deposit.cooldown < memory.distance * 2 + RETURN_MARGIN) {
                    memory.gathering = false;
                }
            }
        }
    } else {
        const storage = Storage(home);
        if (storage !== null) {
            setMovementData(creep, { pos: storage.pos, range: 1 });
            if (creep.pos.isNearTo(storage.pos) && creep.store.getUsedCapacity() > 0) {
                creep.transfer(storage, Object.keys(creep.store)[0] as ResourceConstant);
            }
        }
        if (creep.store.getUsedCapacity() === 0 && memory.distance !== undefined) {
            if (
                memory.distance * 4 + RETURN_MARGIN + Memory.deposits[memory.id].lastCooldown * 5 <
                creep.ticksToLive!
            ) {
                memory.gathering = true;
            } else {
                memory.role = "garbage";
            }
        }
    }
}
