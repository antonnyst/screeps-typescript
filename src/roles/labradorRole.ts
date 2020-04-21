import { CreepRole } from "./creepRole";
import * as C from "../config/constants";

export class LabradorRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }
        if (this.creep.memory.roleData.anyStore === undefined) {
            this.creep.memory.roleData.anyStore = {};
        }
        
        const homeRoom = Game.rooms[this.creep.memory.home];
        if (homeRoom === undefined) {
            return;
        }

        if (this.creep.memory.roleData.anyStore.state === undefined || this.creep.memory.roleData.anyStore.state === "idle") {
            this.chooseState();
        }
        
        this.checkState();

        if (this.creep.memory.roleData.anyStore.state === "move") {
            if (this.creep.memory.roleData.anyStore.pickup === true) {

            } else {
                
            }
        } else if (this.creep.memory.roleData.anyStore.state === "fillTerminal") {

            if (this.creep.memory.roleData.hasEnergy == undefined) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false && this.creep.store.getFreeCapacity() == 0) {
                this.creep.memory.roleData.hasEnergy = true;
            }
        
            if (this.creep.memory.roleData.hasEnergy == true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                this.creep.memory.roleData.hasEnergy = false;
            }
        
            if (this.creep.memory.roleData.hasEnergy == false) {
                this.getEnergy();
            } else {
                let target:Structure|undefined = homeRoom.terminal;
    
                if (target != undefined) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "emptyTerminal") {

            if (this.creep.memory.roleData.hasEnergy == undefined) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false && this.creep.store.getFreeCapacity() == 0) {
                this.creep.memory.roleData.hasEnergy = true;
            }
        
            if (this.creep.memory.roleData.hasEnergy == true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                this.creep.memory.roleData.hasEnergy = false;
            }
        
            if (this.creep.memory.roleData.hasEnergy == false) {
                let target:Structure|undefined = homeRoom.terminal;
    
                if (target != undefined) {
                    if (this.creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            } else {
                let target:Structure|undefined = homeRoom.storage;
    
                if (target != undefined) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "fillLabs") {
            if (this.creep.memory.roleData.hasEnergy == undefined) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false && this.creep.store.getFreeCapacity() == 0) {
                this.creep.memory.roleData.hasEnergy = true;
            }
        
            if (this.creep.memory.roleData.hasEnergy == true && this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0) {
                this.creep.memory.roleData.hasEnergy = false;
            }
        
            if (this.creep.memory.roleData.hasEnergy == false) {
                this.getEnergy();
            } else {
                let target:Structure|null = this.creep.pos.findClosestByRange(homeRoom.find(FIND_MY_STRUCTURES, {filter:(s)=>(s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) as number > 0)}));
                
                if (target != null) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "pickup") {
            if (this.creep.memory.roleData.anyStore.target === null) {
                const target:Structure|undefined = homeRoom.terminal;
                if (target != undefined) {
                    if (this.creep.transfer(target, this.creep.memory.roleData.anyStore.resType) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            } else {
                const target = Game.getObjectById(this.creep.memory.roleData.anyStore.target) as Resource;
                if (target !== null) {
                    const res = this.creep.pickup(target)
                    if (res === OK) {
                        this.creep.memory.roleData.anyStore.target = null;
                        this.creep.memory.roleData.anyStore.resType = target.resourceType;
                    } else if (res === ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos);
                    } else {
                        this.creep.memory.roleData.anyStore.state = "idle";
                        this.creep.memory.roleData.anyStore.target = undefined;
                    }
                } else {
                    this.creep.memory.roleData.anyStore.state = "idle";
                    this.creep.memory.roleData.anyStore.target = undefined;
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "takeTombstone") {
            if (this.creep.memory.roleData.anyStore.target === null) {
                const target:Structure|undefined = homeRoom.terminal;
                if (target != undefined) {
                    if (this.creep.transfer(target, _.findKey(this.creep.store) as ResourceConstant) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos,1);
                    }
                }
            } else {
                const target = Game.getObjectById(this.creep.memory.roleData.anyStore.target) as Tombstone;
                if (target !== null) {
                    const res = this.creep.withdraw(target, _.findKey(target.store) as ResourceConstant )
                    if (res === OK) {
                        this.creep.memory.roleData.anyStore.target = null;
                    } else if (res === ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos);
                    } else {
                        this.creep.memory.roleData.anyStore.state = "idle";
                        this.creep.memory.roleData.anyStore.target = undefined;
                    }
                } else {
                    this.creep.memory.roleData.anyStore.state = "idle";
                    this.creep.memory.roleData.anyStore.target = undefined;
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "moveLab") { 
            if (homeRoom.memory.labs === undefined) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
            } else {
                const tLab = homeRoom.memory.labs.labs[this.creep.memory.roleData.anyStore.target];
                const tRes = tLab.targetResource;

                const lab:StructureLab|null= Game.getObjectById(tLab.id) as StructureLab;


                if (lab != null && tRes != null) {
                    if (this.creep.store.getUsedCapacity(tRes) > 0) {
                        //put in lab
                        
                        if (lab.store.getFreeCapacity(tRes) === 0) {
                            this.creep.memory.roleData.anyStore.state = "pickup";
                            this.creep.memory.roleData.anyStore.target = null;
                            this.creep.memory.roleData.anyStore.resType = tRes;
                        } else if (this.creep.transfer(lab, tRes) == ERR_NOT_IN_RANGE) {
                            this.smartMove(lab.pos,1);
                        }
                        
                    } else {
                        if (lab.store.getFreeCapacity(tRes) === 0) {
                            this.creep.memory.roleData.anyStore.state = "idle";
                            this.creep.memory.roleData.anyStore.target = undefined;
                        } 

                        const target:StructureTerminal|undefined = homeRoom.terminal;
                        if (target != undefined) {
                            if (target.store.getUsedCapacity(tRes) === 0) {
                                this.creep.memory.roleData.anyStore.state = "idle";
                                this.creep.memory.roleData.anyStore.target = undefined;
                            } else if (this.creep.withdraw(target, tRes) == ERR_NOT_IN_RANGE) {
                                this.smartMove(target.pos,1);
                            }
                        } else {
                            this.creep.memory.roleData.anyStore.state = "idle";
                            this.creep.memory.roleData.anyStore.target = undefined;
                        }
                    }
                } else {
                    this.creep.memory.roleData.anyStore.state = "idle";
                    this.creep.memory.roleData.anyStore.target = undefined;
                }  
            }      
        } else if (this.creep.memory.roleData.anyStore.state === "emptyLab") { 
            if (homeRoom.memory.labs === undefined) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
            } else {
                const tLab = homeRoom.memory.labs.labs[this.creep.memory.roleData.anyStore.target];
                const lab:StructureLab|null= Game.getObjectById(tLab.id) as StructureLab;
                if (lab != null) {
                    const tRes = lab.mineralType;
                    if (tRes != undefined) {
                        if (this.creep.store.getUsedCapacity(tRes) > 0) {
                            //take to terminal
                            const target:Structure|undefined = homeRoom.terminal;
                            if (target != undefined) {
                                if (this.creep.transfer(target, _.findKey(this.creep.store) as ResourceConstant) == ERR_NOT_IN_RANGE) {
                                    this.smartMove(target.pos,1);
                                }
                            }
                        } else {
                            const amt:number|null = lab.store.getUsedCapacity(tRes);
                            if (amt != null && amt > 0) {
                                //empty lab
                                if (this.creep.withdraw(lab,tRes) === ERR_NOT_IN_RANGE) {
                                    this.smartMove(lab.pos);
                                }
                            } else {

                            }
                        }                        
                    } else {
                        if (this.creep.store.getFreeCapacity() === this.creep.store.getCapacity()) {
                            this.creep.memory.roleData.anyStore.state = "idle";
                            this.creep.memory.roleData.anyStore.target = undefined;
                        } else {
                            this.creep.memory.roleData.anyStore.state = "takeTombstone";
                            this.creep.memory.roleData.anyStore.target = null;
                        }
                        
                    }     
                } else {
                    this.creep.memory.roleData.anyStore.state = "idle";
                    this.creep.memory.roleData.anyStore.target = undefined;
                }  
            }          
        }
    }
    chooseState() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }
        if (this.creep.memory.roleData.anyStore === undefined) {
            this.creep.memory.roleData.anyStore = {};
        }

        const homeRoom = Game.rooms[this.creep.memory.home];
        if (homeRoom === undefined) {
            return;
        }

        if(homeRoom.terminal != undefined && homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < C.TERMINAL_ENERGY_MIN) {
            this.creep.memory.roleData.anyStore.state = "fillTerminal";
            return;
        }
        if(homeRoom.terminal != undefined && homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > C.TERMINAL_ENERGY_MAX) {
            this.creep.memory.roleData.anyStore.state = "emptyTerminal";
            return;
        }
        if (homeRoom.controller && homeRoom.controller.level > 6 && homeRoom.memory.labs != undefined && homeRoom.memory.labs.status !== "react") {
            for(const l in homeRoom.memory.labs.labs) {
                const lab = homeRoom.memory.labs.labs[l];
                const labObj = Game.getObjectById(lab.id) as StructureLab;
                if (labObj != null) {
                    if ((labObj.mineralType === undefined && lab.targetResource !== null) || (lab.targetResource != null && labObj.mineralType === lab.targetResource && labObj.store.getFreeCapacity(labObj.mineralType) as number > 0)) {
                        //we need to fill;
                        if (homeRoom.terminal != undefined && homeRoom.terminal.store.getUsedCapacity(lab.targetResource) > 0) {
                            //we can fill it;
                            this.creep.memory.roleData.anyStore.state = "moveLab";
                            this.creep.memory.roleData.anyStore.target = parseInt(l);
                            return;
                        }
                    } else if ((lab.targetResource === null && labObj.mineralType != null) || (lab.targetResource !== null && labObj.mineralType != null && labObj.mineralType != lab.targetResource)) {
                        //we need to empty 
                        this.creep.memory.roleData.anyStore.state = "emptyLab";
                        this.creep.memory.roleData.anyStore.target = parseInt(l);
                        return;
                    }
                }
            }
        }

        if (homeRoom.controller && homeRoom.controller.level > 5) {
            const labs = homeRoom.find(FIND_MY_STRUCTURES, {filter:(s)=>(s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) as number > 0)});
            
            if (labs.length > 0) {
                this.creep.memory.roleData.anyStore.state = "fillLabs";
                return;
            }

            let rooms:Room[] = [homeRoom];

            for (const r of homeRoom.memory.remotes) {
                if (Game.rooms[r] != undefined) {
                    rooms.push(Game.rooms[r]);
                }
            }

            let droppedResources:Resource<ResourceConstant>[] = [];
            for (const r of rooms) {
                const res = r.find(FIND_DROPPED_RESOURCES, {filter:(dr)=>(dr.amount >= 30)});
                droppedResources = droppedResources.concat(res);
            }
            if (droppedResources.length > 0) {
                const closest = droppedResources[0];
                if (closest != null) {
                    this.creep.memory.roleData.anyStore.state = "pickup";
                    this.creep.memory.roleData.anyStore.target = closest.id;
                    return;
                }
            }
            let tombstones:Tombstone[] = [];
            for (const r of rooms) {
                const res = r.find(FIND_TOMBSTONES, {filter:(s)=>(s.store.getUsedCapacity() > 0)});
                tombstones = tombstones.concat(res);
            }
            if (tombstones.length > 0) {
                const closest = tombstones[0];
                if (closest != null) {
                    this.creep.memory.roleData.anyStore.state = "takeTombstone";
                    this.creep.memory.roleData.anyStore.target = closest.id;
                    return;
                }
            }
        }
        

        this.creep.memory.roleData.anyStore.state = "idle";
        return;
    }
    checkState() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }
        if (this.creep.memory.roleData.anyStore === undefined) {
            this.creep.memory.roleData.anyStore = {};
        }
        const homeRoom = Game.rooms[this.creep.memory.home];
        if (homeRoom === undefined) {
            return;
        }
        if (this.creep.memory.roleData.anyStore.state === "fillTerminal") {
            if(homeRoom.terminal != undefined && homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= C.TERMINAL_ENERGY_MIN) {
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "emptyTerminal") {
            if(this.creep.store.energy === 0 && homeRoom.terminal != undefined && homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) <= C.TERMINAL_ENERGY_MAX) {
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "fillLabs") {
            const labs = homeRoom.find(FIND_MY_STRUCTURES, {filter:(s)=>(s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) as number > 0)});

            if (labs.length === 0) { 
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "pickup") {
            if (this.creep.memory.roleData.anyStore.target !== null && Game.getObjectById(this.creep.memory.roleData.anyStore.target) === null) { 
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            } else if (this.creep.memory.roleData.anyStore.target === null && this.creep.store.getUsedCapacity() === 0) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                this.creep.memory.roleData.anyStore.resType = undefined;
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "takeTombstone") {
            if (this.creep.memory.roleData.anyStore.target !== null && Game.getObjectById(this.creep.memory.roleData.anyStore.target) === null) { 
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            } else if (this.creep.memory.roleData.anyStore.target === null && this.creep.store.getUsedCapacity() === 0) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "moveLab") {
            if (this.creep.memory.roleData.anyStore.target === null) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "emptyLab") {
            if (this.creep.memory.roleData.anyStore.target === null) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            }
        }
    }
}

//possible states
//idle
//fill terminal (energy)
//empty terminal (energy)
//fill labs (energy)
//move lab
//empty lab
//pickup