import { Manager } from "./manager";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class DefenseManager implements Manager {
    public run() {
        for (let room in Game.rooms) { 
            RunTowers(Game.rooms[room]);
        }
    }
}

function RunTowers(room: Room):void {
    const towers:StructureTower[] = room.find(FIND_MY_STRUCTURES, {
        filter:(s)=>(s.structureType === STRUCTURE_TOWER)
    }) as StructureTower[];

    if (towers.length > 0) {
        const hostiles:Creep[] = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            const dangerousHostiles:Creep[] = _.filter(hostiles, (h:Creep)=>((h.getActiveBodyparts(WORK) || h.getActiveBodyparts(ATTACK) || h.getActiveBodyparts(RANGED_ATTACK) || h.getActiveBodyparts(HEAL) || h.getActiveBodyparts(CARRY)) || (room.memory.hostiles[h.id] != undefined && room.memory.hostiles[h.id].firstSeen < Game.time - 50)));
            const basePos:RoomPosition = unpackPosition(room.memory.layout.baseCenter);

            const target:Creep|null = basePos.findClosestByRange(dangerousHostiles);

            if (target != null) {
                towers.forEach(tower => {
                    tower.attack(target);
                });
            } 
        } else {

            const friendlyHealTargets:Creep[] = room.find(FIND_MY_CREEPS, {
                filter:(c)=>(c.hits < c.hitsMax)
            });

            const basePos:RoomPosition = unpackPosition(room.memory.layout.baseCenter);
            const target:Creep|null = basePos.findClosestByRange(friendlyHealTargets);

            if (target != null) {
                towers.forEach(tower => {
                    tower.heal(target);
                });
            } 


        }
    }
}