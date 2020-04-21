import { CreepRole } from "./creepRole";

export class FootRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }


        if (Memory.rooms[this.creep.memory.home] === undefined || Memory.rooms[this.creep.memory.home].layout === undefined) {
            return;
        }
        
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {

            };
        }

        if (this.creep.memory.roleData.hasEnergy === undefined) {
            this.creep.memory.roleData.hasEnergy = false;
        }
    
        if (this.creep.memory.roleData.hasEnergy == false && this.creep.store.getFreeCapacity() == 0) {
            this.creep.memory.roleData.hasEnergy = true;
        }
    
        if (this.creep.memory.roleData.hasEnergy == true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
            this.creep.memory.roleData.hasEnergy = false;
        }
    
        if (this.creep.memory.roleData.hasEnergy === false) {
            this.getEnergy();
        } else {
            let target = this.creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                filter: (s)=>((s.structureType == STRUCTURE_EXTENSION || s.structureType == STRUCTURE_SPAWN) && s.store.getFreeCapacity(RESOURCE_ENERGY) as number > 0)
            });
            if (target != null) {
                if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    this.smartMove(target.pos);
                }
            } else {
                let csite:ConstructionSite|null = this.creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
                    filter:(s)=>(s.structureType === STRUCTURE_SPAWN)
                })[0];

                if (csite == null) {
                    csite = this.creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
                }

                if (csite != null) {
                    if (this.creep.build(csite) == ERR_NOT_IN_RANGE) {
                        this.smartMove(csite.pos);
                    }
                }
            }
        }
    }
}