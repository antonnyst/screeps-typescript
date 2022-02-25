declare global {
  interface RoomMemory {
    linkStatus: LinkStatus;
  }
}

declare type LinkStatus = "fill" | "empty";

export function LinkHandler(room: OwnedRoom): void {
  if (room.controller.level < 5 || room.memory.genBuildings === undefined) {
    return;
  }

  const fillLinks: StructureLink[] = [];
  let centerLink: StructureLink | null = null;
  const minerLinks: StructureLink[] = [];

  for (let i = 0; i < room.memory.genBuildings.links.length; i++) {
    if (room.memory.genBuildings.links[i].id !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
            fillLinks.unshift(linkObject as StructureLink);
            break;
          default:
            minerLinks.push(linkObject as StructureLink);
            break;
        }
      }
    }
  }

  let fillNeeds = false;

  // Fill fillLinks if they need to be filled
  for (const link of fillLinks) {
    if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 50) {
      fillNeeds = true;
      let supplyLink: StructureLink | null = null;
      const need: number = link.store.getFreeCapacity(RESOURCE_ENERGY);

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
      const capacity = centerLink.store.getFreeCapacity(RESOURCE_ENERGY);
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
}
