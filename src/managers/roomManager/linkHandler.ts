export function LinkHandler(room: Room): void {
    if (room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        if (room.controller.level < 5 || room.memory.genBuildings === undefined) {
            return;
        }

        const fillLinks: StructureLink[] = [];
        let centerLink: StructureLink | null = null;
        const minerLinks: StructureLink[] = [];

        for (let i = 0; i < room.memory.genBuildings.links.length; i++) {
            if (room.memory.genBuildings.links[i].id !== undefined) {
                const linkObject = Game.getObjectById(room.memory.genBuildings.links[i].id!);
                if (linkObject !== null && linkObject instanceof Structure) {
                    switch (i) {
                        case 0:
                            fillLinks.push(linkObject as StructureLink);
                            break;
                        case 1:
                            centerLink = linkObject as StructureLink;
                            break;
                        case 2:
                            fillLinks.push(linkObject as StructureLink);
                            break;
                        default:
                            minerLinks.push(linkObject as StructureLink);
                            break;
                    }
                }
            }
        }

        let fillNeeds: boolean = false;

        // Fill fillLinks if they need to be filled
        for (const link of fillLinks) {
            if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 50) {
                fillNeeds = true;
                let supplyLink: StructureLink | null = null;
                let need: number = link.store.getFreeCapacity(RESOURCE_ENERGY);

                for (const mlink of minerLinks) {
                    if (mlink.store.getUsedCapacity(RESOURCE_ENERGY) >= need) {
                        supplyLink = mlink;
                        break;
                    }
                }

                if (supplyLink === null && centerLink !== null) {
                    if (centerLink.store.getUsedCapacity(RESOURCE_ENERGY) >= need) {
                        supplyLink = centerLink;
                    }
                }

                if (supplyLink !== null) {
                    supplyLink.transferEnergy(link, need);
                    break;
                }
            }
        }

        if (!fillNeeds) {
            if (centerLink !== null) {
                let capacity = centerLink.store.getFreeCapacity(RESOURCE_ENERGY);
                for (const mlink of minerLinks) {
                    if (mlink.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        if (capacity > centerLink.store.getCapacity(RESOURCE_ENERGY) / 2) {
                            mlink.transferEnergy(centerLink);
                            break;
                        }
                    }
                }
            }
        }

        if (fillNeeds) {
            room.memory.linkStatus = "fill";
        } else {
            room.memory.linkStatus = "empty";
        }

        /*
        const storage = room.storage;
        const controllerLink: StructureLink | null = _.filter(
            unpackPosition(room.memory.layout.controllerStore).lookFor(LOOK_STRUCTURES),
            (s: Structure) => s.structureType === STRUCTURE_LINK
        )[0] as StructureLink;
        if (controllerLink === null) {
            return;
        }
        const cPos = unpackPosition(room.memory.layout.baseCenter);
        const lPos = new RoomPosition(cPos.x + 1, cPos.y, cPos.roomName);
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
            if (!transfered && baseLink !== undefined) {
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
        }*/
    }
}
