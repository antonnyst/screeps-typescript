import { unpackPosition } from "../../utils/RoomPositionPacker";
import * as C from "../../config/constants";

export function LinkHandler(room: Room): void {
    if (room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        if (room.controller.level < 5) {
            return;
        }

        const storage = room.storage;
        const controllerLink: StructureLink | null = _.filter(
            unpackPosition(room.memory.layout.controllerStore).lookFor(LOOK_STRUCTURES),
            (s: Structure) => s.structureType === STRUCTURE_LINK
        )[0] as StructureLink;
        if (controllerLink === null) {
            return;
        }
        const cPos = unpackPosition(room.memory.layout.baseCenter);
        const lPos = new RoomPosition(cPos.x, cPos.y - 1, cPos.roomName);
        const baseLink: StructureLink | null = _.filter(
            lPos.lookFor(LOOK_STRUCTURES),
            (s: Structure) => s.structureType === STRUCTURE_LINK
        )[0] as StructureLink;
        if (baseLink === null) {
            return;
        }

        const minerLinks: StructureLink[] = _.filter(
            room.find(FIND_MY_STRUCTURES),
            (s: Structure) =>
                s.structureType === STRUCTURE_LINK &&
                !s.pos.isEqualTo(lPos) &&
                !s.pos.isEqualTo(unpackPosition(room.memory.layout.controllerStore))
        ) as StructureLink[];

        if (room.controller!.ticksToDowngrade < 20000) {
            room.memory.linkStatus = "empty";
        } else if (storage === undefined) {
            room.memory.linkStatus = "empty";
        } else if (
            storage.store.getUsedCapacity(RESOURCE_ENERGY) > C.BASE_LINK_GREEDY_LIMIT &&
            controllerLink !== undefined &&
            (controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) as number) >= 25
        ) {
            room.memory.linkStatus = "fill";
        } else {
            room.memory.linkStatus = "empty";
        }

        if (room.memory.linkStatus === "fill") {
            // its "fill" so send to controller if possible

            const eNeeded = controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) as number;
            let transfered = false;
            if (minerLinks.length > 0) {
                if (
                    minerLinks[0].cooldown === 0 &&
                    (minerLinks[0].store.getUsedCapacity(RESOURCE_ENERGY) as number) >= eNeeded
                ) {
                    minerLinks[0].transferEnergy(controllerLink);
                    transfered = true;
                } else {
                    if (minerLinks.length > 1) {
                        if (
                            minerLinks[1].cooldown === 0 &&
                            (minerLinks[1].store.getUsedCapacity(RESOURCE_ENERGY) as number) >= eNeeded
                        ) {
                            minerLinks[1].transferEnergy(controllerLink);
                            transfered = true;
                        }
                    }
                }
            }
            if (!transfered) {
                const r = baseLink.store.getUsedCapacity(RESOURCE_ENERGY) as number;
                if (r >= eNeeded) {
                    baseLink.transferEnergy(controllerLink);
                }
            }
        } else {
            // its "empty" so send to baseLink if possible
            if (baseLink !== undefined) {
                const eNeeded = baseLink.store.getFreeCapacity(RESOURCE_ENERGY) as number;

                if (eNeeded >= 25) {
                    if (minerLinks.length > 0) {
                        if (
                            minerLinks[0].cooldown === 0 &&
                            (minerLinks[0].store.getUsedCapacity(RESOURCE_ENERGY) as number) >= eNeeded
                        ) {
                            minerLinks[0].transferEnergy(baseLink);
                        } else {
                            if (minerLinks.length > 1) {
                                if (
                                    minerLinks[1].cooldown === 0 &&
                                    (minerLinks[1].store.getUsedCapacity(RESOURCE_ENERGY) as number) >= eNeeded
                                ) {
                                    minerLinks[1].transferEnergy(baseLink);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
