import { unpackPosition } from "./RoomPositionPacker";

export function roomTotalStoredEnergy(room:Room):number {

    const containers = _.sum(room.find(FIND_STRUCTURES,{filter:(s)=>(s.structureType === STRUCTURE_CONTAINER)}),(s:Structure)=>((s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY)));
    const storage = (room.storage !== undefined) ? room.storage.store.getUsedCapacity(RESOURCE_ENERGY) : 0;

    const cpos = unpackPosition(room.memory.layout.baseCenter);
    const lpos = new RoomPosition(cpos.x,cpos.y-1,cpos.roomName);

    const blink = _.filter(lpos.lookFor(LOOK_STRUCTURES),(s:Structure)=>(s.structureType === STRUCTURE_LINK))[0] as StructureLink;

    const link = (blink !== undefined) ? blink.store.getUsedCapacity(RESOURCE_ENERGY) as number : 0;

    return containers + storage + link;
}