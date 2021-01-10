import { CreepRole } from "./creepRole";
import * as C from "../config/constants";
import { unpackPosition } from "utils/RoomPositionPacker";

// possible states
// idle
// fill terminal (energy)
// empty terminal (energy)
// fill labs (energy)
// move lab
// empty lab
// pickup

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
            } else {
                // we didnt find anything in the queue
                // get a task and fill queue if possible
                this.getTask();
            }
        }

        if (this.creep.memory.labrador.task !== undefined) {
            this.executeTask();
        } else {
            this.setMovementData(
                unpackPosition(Memory.rooms[this.creep.memory.home].layout.baseCenter),
                3,
                false,
                false
            );
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
        // get the object
        // get object position
        // if not adjacent to object move there
        // if adjacent to object, withdraw/transfer/pickup object
        // and assign new task if it works
        const target: AnyStoreStructure | Tombstone | Resource | null = Game.getObjectById(
            this.creep.memory.labrador.task.id
        );
        if (target === null) {
            // object is gone.
            this.creep.memory.labrador.task = undefined;
            return;
        }

        const range: number = this.creep.pos.getRangeTo(target.pos);

        this.setMovementData(target.pos, 1, false, false);

        if (this.creep.pos.isNearTo(target.pos)) {
            let result: number = -99;

            switch (this.creep.memory.labrador.task.type) {
                case "transfer":
                    if (!(target instanceof Resource) && !(target instanceof Tombstone)) {
                        // filter out Resource and Tombstone
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
                        // filter out Resource
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
                        // only Resource
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
                    const ttarget: AnyStoreStructure | Tombstone | Resource | null = Game.getObjectById(
                        this.creep.memory.labrador.task.id
                    );
                    if (ttarget === null) {
                        // object is gone.
                        this.creep.memory.labrador.task = undefined;
                        return;
                    }

                    this.setMovementData(ttarget.pos, 1, false, false);
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

            const resource: ResourceConstant = _.findKey(this.creep.store) as ResourceConstant;
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

        // TODO lab filling

        // TODO factory transport

        // TODO pickup tombstones/resources
    }
}
