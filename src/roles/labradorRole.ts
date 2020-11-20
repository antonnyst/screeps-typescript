import { CreepRole } from "./creepRole";
import * as C from "../config/constants";

export class OldLabradorRole extends CreepRole {
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
        if (
            this.creep.memory.roleData.anyStore.state === undefined ||
            this.creep.memory.roleData.anyStore.state === "idle"
        ) {
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

            if (
                this.creep.memory.roleData.hasEnergy == true &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0
            ) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false) {
                this.getEnergy();
            } else {
                let target: Structure | undefined = homeRoom.terminal;

                if (target != undefined) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 1);
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

            if (
                this.creep.memory.roleData.hasEnergy == true &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0
            ) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false) {
                let target: Structure | undefined = homeRoom.terminal;

                if (target != undefined) {
                    if (this.creep.withdraw(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 1);
                    }
                }
            } else {
                let target: Structure | undefined = homeRoom.storage;

                if (target != undefined) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 1);
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

            if (
                this.creep.memory.roleData.hasEnergy == true &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) == 0
            ) {
                this.creep.memory.roleData.hasEnergy = false;
            }

            if (this.creep.memory.roleData.hasEnergy == false) {
                this.getEnergy();
            } else {
                let target: Structure | null = this.creep.pos.findClosestByRange(
                    homeRoom.find(FIND_MY_STRUCTURES, {
                        filter: (s) =>
                            s.structureType === STRUCTURE_LAB &&
                            (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
                    })
                );

                if (target != null) {
                    if (this.creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 1);
                    }
                }
            }
        } else if (this.creep.memory.roleData.anyStore.state === "pickup") {
            if (this.creep.memory.roleData.anyStore.target === null) {
                const target: Structure | undefined = homeRoom.terminal;
                if (target != undefined) {
                    if (this.creep.transfer(target, this.creep.memory.roleData.anyStore.resType) == ERR_NOT_IN_RANGE) {
                        this.smartMove(target.pos, 1);
                    }
                }
            } else {
                const target = Game.getObjectById(this.creep.memory.roleData.anyStore.target) as Resource;
                if (target !== null) {
                    const res = this.creep.pickup(target);
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
                const target: Structure | undefined = homeRoom.terminal;
                if (target != undefined) {
                    if (
                        this.creep.transfer(target, _.findKey(this.creep.store) as ResourceConstant) == ERR_NOT_IN_RANGE
                    ) {
                        this.smartMove(target.pos, 1);
                    }
                }
            } else {
                const target = Game.getObjectById(this.creep.memory.roleData.anyStore.target) as Tombstone;
                if (target !== null) {
                    const res = this.creep.withdraw(target, _.findKey(target.store) as ResourceConstant);
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

                const lab: StructureLab | null = Game.getObjectById(tLab.id) as StructureLab;

                if (lab != null && tRes != null) {
                    if (this.creep.store.getUsedCapacity(tRes) > 0) {
                        //put in lab

                        if (lab.store.getFreeCapacity(tRes) === 0) {
                            this.creep.memory.roleData.anyStore.state = "pickup";
                            this.creep.memory.roleData.anyStore.target = null;
                            this.creep.memory.roleData.anyStore.resType = tRes;
                        } else if (this.creep.transfer(lab, tRes) == ERR_NOT_IN_RANGE) {
                            this.smartMove(lab.pos, 1);
                        }
                    } else {
                        if (lab.store.getFreeCapacity(tRes) === 0) {
                            this.creep.memory.roleData.anyStore.state = "idle";
                            this.creep.memory.roleData.anyStore.target = undefined;
                        }

                        const target: StructureTerminal | undefined = homeRoom.terminal;
                        if (target != undefined) {
                            if (target.store.getUsedCapacity(tRes) === 0) {
                                this.creep.memory.roleData.anyStore.state = "idle";
                                this.creep.memory.roleData.anyStore.target = undefined;
                            } else if (this.creep.withdraw(target, tRes) == ERR_NOT_IN_RANGE) {
                                this.smartMove(target.pos, 1);
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
                const lab: StructureLab | null = Game.getObjectById(tLab.id) as StructureLab;
                if (lab != null) {
                    const tRes = lab.mineralType;
                    if (tRes != undefined) {
                        if (this.creep.store.getUsedCapacity(tRes) > 0) {
                            //take to terminal
                            const target: Structure | undefined = homeRoom.terminal;
                            if (target != undefined) {
                                if (
                                    this.creep.transfer(target, _.findKey(this.creep.store) as ResourceConstant) ==
                                    ERR_NOT_IN_RANGE
                                ) {
                                    this.smartMove(target.pos, 1);
                                }
                            }
                        } else {
                            const amt: number | null = lab.store.getUsedCapacity(tRes);
                            if (amt != null && amt > 0) {
                                //empty lab
                                if (this.creep.withdraw(lab, tRes) === ERR_NOT_IN_RANGE) {
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

        if (
            homeRoom.terminal != undefined &&
            homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < C.TERMINAL_ENERGY_MIN
        ) {
            this.creep.memory.roleData.anyStore.state = "fillTerminal";
            return;
        }
        if (
            homeRoom.terminal != undefined &&
            homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > C.TERMINAL_ENERGY_MAX
        ) {
            this.creep.memory.roleData.anyStore.state = "emptyTerminal";
            return;
        }
        if (
            homeRoom.controller &&
            homeRoom.controller.level > 6 &&
            homeRoom.memory.labs != undefined &&
            homeRoom.memory.labs.status !== "react"
        ) {
            for (const l in homeRoom.memory.labs.labs) {
                const lab = homeRoom.memory.labs.labs[l];
                const labObj = Game.getObjectById(lab.id) as StructureLab;
                if (labObj != null) {
                    if (
                        (labObj.mineralType === undefined && lab.targetResource !== null) ||
                        (lab.targetResource != null &&
                            labObj.mineralType === lab.targetResource &&
                            (labObj.store.getFreeCapacity(labObj.mineralType) as number) > 0)
                    ) {
                        //we need to fill;
                        if (
                            homeRoom.terminal != undefined &&
                            homeRoom.terminal.store.getUsedCapacity(lab.targetResource) > 0
                        ) {
                            //we can fill it;
                            this.creep.memory.roleData.anyStore.state = "moveLab";
                            this.creep.memory.roleData.anyStore.target = parseInt(l);
                            return;
                        }
                    } else if (
                        (lab.targetResource === null && labObj.mineralType != null) ||
                        (lab.targetResource !== null &&
                            labObj.mineralType != null &&
                            labObj.mineralType != lab.targetResource)
                    ) {
                        //we need to empty
                        this.creep.memory.roleData.anyStore.state = "emptyLab";
                        this.creep.memory.roleData.anyStore.target = parseInt(l);
                        return;
                    }
                }
            }
        }

        if (homeRoom.controller && homeRoom.controller.level > 5) {
            const labs = homeRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) =>
                    s.structureType === STRUCTURE_LAB && (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
            });

            if (labs.length > 0) {
                this.creep.memory.roleData.anyStore.state = "fillLabs";
                return;
            }

            let rooms: Room[] = [homeRoom];

            for (const r of homeRoom.memory.remotes) {
                if (Game.rooms[r] != undefined) {
                    rooms.push(Game.rooms[r]);
                }
            }

            let droppedResources: Resource<ResourceConstant>[] = [];
            for (const r of rooms) {
                const res = r.find(FIND_DROPPED_RESOURCES, { filter: (dr) => dr.amount >= 30 });
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
            let tombstones: Tombstone[] = [];
            for (const r of rooms) {
                const res = r.find(FIND_TOMBSTONES, { filter: (s) => s.store.getUsedCapacity() > 0 });
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
            if (
                homeRoom.terminal != undefined &&
                homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= C.TERMINAL_ENERGY_MIN
            ) {
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "emptyTerminal") {
            if (
                this.creep.store.energy === 0 &&
                homeRoom.terminal != undefined &&
                homeRoom.terminal.store.getUsedCapacity(RESOURCE_ENERGY) <= C.TERMINAL_ENERGY_MAX
            ) {
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "fillLabs") {
            const labs = homeRoom.find(FIND_MY_STRUCTURES, {
                filter: (s) =>
                    s.structureType === STRUCTURE_LAB && (s.store.getFreeCapacity(RESOURCE_ENERGY) as number) > 0
            });

            if (labs.length === 0) {
                this.creep.memory.roleData.anyStore.state = "idle";
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "pickup") {
            if (
                this.creep.memory.roleData.anyStore.target !== null &&
                Game.getObjectById(this.creep.memory.roleData.anyStore.target) === null
            ) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            } else if (
                this.creep.memory.roleData.anyStore.target === null &&
                this.creep.store.getUsedCapacity() === 0
            ) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                this.creep.memory.roleData.anyStore.resType = undefined;
                return;
            }
        }
        if (this.creep.memory.roleData.anyStore.state === "takeTombstone") {
            if (
                this.creep.memory.roleData.anyStore.target !== null &&
                Game.getObjectById(this.creep.memory.roleData.anyStore.target) === null
            ) {
                this.creep.memory.roleData.anyStore.state = "idle";
                this.creep.memory.roleData.anyStore.target = undefined;
                return;
            } else if (
                this.creep.memory.roleData.anyStore.target === null &&
                this.creep.store.getUsedCapacity() === 0
            ) {
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

// REWORK

// goals of labrador

// if terminal is missing stuff
// fill from storage
// if terminal has too much stuff
// empty to storage

// if factory is missing stuff
// fill from terminal
// if factory has too much stuff
// empty to terminal

// if lab is missing stuff
// fill lab from terminal
// if lab has too much stuff
// empty to terminal

// if theres resources on ground or in tombstone
// gather and put in terminal

// roles of structures
// storage : store abundant stuff, keep energy for fillers
// terminal : hub of resources, keep a little bit of everything
// factory : work the factory, transport with terminal
// lab : work the lab, transport with terminal

// runRole() start point of role
// getTask() assign a task to creep and fill the queue with additional tasks if possible
// executeTask() execute the current task; move to target and do action.

export class LabradorRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        this.creep.memory.labrador = this.creep.memory.labrador || {
            task: undefined,
            qtask: []
        };

        if (this.creep.memory.labrador.task === undefined) {
            // we have no task
            if (this.creep.memory.labrador.qtask.length > 0) {
                // there are tasks in the queue
                this.creep.memory.labrador.task = this.creep.memory.labrador.qtask.shift();
            }

            if (this.creep.memory.labrador.task === undefined) {
                // we didnt find anything in the queue
                // get a task and fill queue if possible
                this.getTask();
            }
        }

        if (this.creep.memory.labrador.task !== undefined) {
            this.executeTask();
        }
    }
    executeTask() {
        if (this.creep === null) {
            return;
        }
        this.creep.memory.labrador = this.creep.memory.labrador || {
            task: undefined,
            qtask: []
        };
        if (this.creep.memory.labrador.task === undefined) {
            return;
        }
        // lets execute the task
        /*task = {
            id:123123123,
            resourceType:RESOURCE_ENERGY,
            amount:200,
            type:"transfer" | "withdraw" | "pickup"
        }*/
        //get the object
        //get object position
        //if not adjacent to object move there
        //if adjacent to object, withdraw/transfer/pickup object
        //and assign new task if it works
        const target: AnyStoreStructure | Tombstone | Resource | null = Game.getObjectById(
            this.creep.memory.labrador.task.id
        );
        if (target === null) {
            //object is gone.
            this.creep.memory.labrador.task = undefined;
            return;
        }

        const range: number = this.creep.pos.getRangeTo(target.pos);

        if (range > 1) {
            this.smartMove(target, 1);
        } else {
            let result: number = -99;

            switch (this.creep.memory.labrador.task.type) {
                case "transfer":
                    if (!(target instanceof Resource) && !(target instanceof Tombstone)) {
                        //filter out Resource and Tombstone
                        result = this.creep.transfer(
                            target,
                            this.creep.memory.labrador.task.resourceType,
                            this.creep.memory.labrador.task.amount
                        );
                    } else {
                        console.log("transfer type while target is resource or tombstone");
                    }
                    break;
                case "withdraw":
                    if (!(target instanceof Resource)) {
                        //filter out Resource
                        result = this.creep.withdraw(
                            target,
                            this.creep.memory.labrador.task.resourceType,
                            this.creep.memory.labrador.task.amount
                        );
                    } else {
                        console.log("withdraw type while target is resource");
                    }
                    break;
                case "pickup":
                    if (target instanceof Resource) {
                        //only Resource
                        result = this.creep.pickup(target);
                    } else {
                        console.log("pickup type while target is not resource");
                    }
                    break;
            }

            if (result !== 0) {
                // we failed the task
                // clear the queue since it might be dependent on previous task
                this.creep.memory.labrador.task = undefined;
                this.creep.memory.labrador.qtask = [];
                return;
            }

            if (this.creep.memory.labrador.qtask.length > 0) {
                this.creep.memory.labrador.task = this.creep.memory.labrador.qtask.shift();
                if (this.creep.memory.labrador.task !== undefined) {
                    const target: AnyStoreStructure | Tombstone | Resource | null = Game.getObjectById(
                        this.creep.memory.labrador.task.id
                    );
                    if (target === null) {
                        //object is gone.
                        this.creep.memory.labrador.task = undefined;
                        return;
                    }

                    const range: number = this.creep.pos.getRangeTo(target.pos);

                    if (range > 1) {
                        this.smartMove(target, 1);
                    }
                }
            } else {
                this.creep.memory.labrador.task = undefined;
            }
        }
    }
    getTask() {
        if (this.creep === null) {
            return;
        }

        this.creep.memory.labrador = this.creep.memory.labrador || {
            task: undefined,
            qtask: []
        };

        const room: Room = Game.rooms[this.creep.memory.home];

        if (room === undefined) {
            return;
        }

        const terminal: StructureTerminal | undefined = room.terminal;
        const storage: StructureStorage | undefined = room.storage;

        // check for stray resources
        if (this.creep.store.getUsedCapacity() > 0) {
            // we dont have any tasks but we have resources in carry
            // we put them in the terminal so we can handle them later

            if (terminal === undefined) {
                return;
            }

            const resource: ResourceConstant = _.findKey(this.creep.store);
            const amount: number = this.creep.store.getUsedCapacity(resource);
            const freeAmount: number = terminal.store.getFreeCapacity(resource);

            const possibleAmount = Math.min(amount, freeAmount);

            if (possibleAmount > 0) {
                // we can do it
                // only one task needed
                // task1 : put resources in terminal

                const task1: LabradorTask = {
                    id: terminal.id,
                    resourceType: resource,
                    amount: possibleAmount,
                    type: "transfer"
                };

                this.creep.memory.labrador.task = task1;
                this.creep.memory.labrador.qtask = [];
                return;
            }

            return;
        }

        // terminal fill/empty
        if (terminal !== undefined && storage !== undefined) {
            for (const resource of RESOURCES_ALL) {
                const amount = terminal.store.getUsedCapacity(resource);

                let minAmount: number = 0;
                let maxAmount: number = Infinity;

                if (resource === RESOURCE_ENERGY) {
                    minAmount = C.TERMINAL_ENERGY_MIN;
                    maxAmount = C.TERMINAL_ENERGY_MAX;
                } else if (C.TERMINAL_MINERALS.includes(resource)) {
                    minAmount = C.TERMINAL_MINERAL_MIN;
                    maxAmount = C.TERMINAL_MINERAL_MAX;
                } else if (C.TERMINAL_BOOSTS.includes(resource)) {
                    minAmount = C.TERMINAL_BOOST_MIN;
                    maxAmount = C.TERMINAL_BOOST_MAX;
                } else if (C.TERMINAL_COMMODITIES.includes(resource)) {
                    minAmount = C.TERMINAL_COMMODITY_MIN;
                    maxAmount = C.TERMINAL_COMMODITY_MAX;
                }

                if (amount < minAmount) {
                    // we should add more of resource to terminal;
                    const storageAmount = storage.store.getUsedCapacity(resource);

                    // the optimal amount we want to add to terminal
                    const targetAmount = minAmount - amount;

                    // the possible amount we can add to terminal
                    const possibleAmount = Math.min(targetAmount, storageAmount, this.creep.carryCapacity);

                    if (possibleAmount > 0) {
                        // we can do it!
                        // there are two tasks needed
                        // task1 : grab resources from storage
                        // task2 : put resources in terminal

                        const task1: LabradorTask = {
                            id: storage.id,
                            resourceType: resource,
                            amount: possibleAmount,
                            type: "withdraw"
                        };

                        const task2: LabradorTask = {
                            id: terminal.id,
                            resourceType: resource,
                            amount: possibleAmount,
                            type: "transfer"
                        };

                        this.creep.memory.labrador.task = task1;
                        this.creep.memory.labrador.qtask = [task2];
                        return;
                    }
                } else if (amount > maxAmount) {
                    // we should empty the terminal to the storage;

                    const freeAmount = storage.store.getFreeCapacity(resource);

                    // the omptimal amount we should empty from the terminal
                    const targetAmount = amount - maxAmount;

                    // the possible amount we can add to terminal
                    const possibleAmount = Math.min(targetAmount, freeAmount, this.creep.carryCapacity);

                    if (possibleAmount > 0) {
                        // we can do it!
                        // there are two tasks needed
                        // task1 : grab resources from terminal
                        // task2 : put resources in storage

                        const task1: LabradorTask = {
                            id: terminal.id,
                            resourceType: resource,
                            amount: possibleAmount,
                            type: "withdraw"
                        };

                        const task2: LabradorTask = {
                            id: storage.id,
                            resourceType: resource,
                            amount: possibleAmount,
                            type: "transfer"
                        };

                        this.creep.memory.labrador.task = task1;
                        this.creep.memory.labrador.qtask = [task2];
                        return;
                    }
                }
            }
        }

        //TODO lab filling

        //TODO factory transport

        //TODO pickup tombstones/resources
    }
}
