import { unpackPosition } from "utils/RoomPositionPacker";
import { CreepRole } from "./creepRole";
import * as C from "../config/constants";

export class ManagerRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        if (this.creep.store.getUsedCapacity() > 0) {
            if (this.creep.memory.roleData.targetId !== undefined) {
                const target = Game.getObjectById(this.creep.memory.roleData.targetId) as AnyStoreStructure;
                this.creep.transfer(target, Object.keys(this.creep.store)[0] as ResourceConstant);
                this.creep.memory.roleData.targetId = undefined;
            } else {
                const target = this.creep.room.storage;
                if (target !== undefined) {
                    this.creep.transfer(target, Object.keys(this.creep.store)[0] as ResourceConstant);
                }
            }
        } else {
            this.startTask();
        }
    }
    startTask() {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.roleData === undefined) {
            this.creep.memory.roleData = {};
        }

        const room: Room = Game.rooms[this.creep.memory.home];

        if (room === undefined) {
            return;
        }

        const link: StructureLink | null =
            room.memory.genBuildings?.links[1].id !== undefined &&
            Game.getObjectById(room.memory.genBuildings?.links[1].id) instanceof StructureLink
                ? (Game.getObjectById(room.memory.genBuildings?.links[1].id) as StructureLink)
                : null;

        const terminal: StructureTerminal | undefined = room.terminal;
        const storage: StructureStorage | undefined = room.storage;

        if (storage !== undefined && link !== null && room.memory.linkStatus !== undefined) {
            if (room.memory.linkStatus === "fill" && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                // We should fill the link
                const storageEnergy = storage.store.getUsedCapacity(RESOURCE_ENERGY);
                const fillNeeded = link.store.getFreeCapacity(RESOURCE_ENERGY);
                const possibleAmount = Math.min(fillNeeded, storageEnergy, this.creep.store.getCapacity());

                if (possibleAmount > 0) {
                    // We can do it

                    this.creep.withdraw(storage, RESOURCE_ENERGY, possibleAmount);
                    this.creep.memory.roleData.targetId = link.id;
                    return;
                }
            }
            if (room.memory.linkStatus === "empty" && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // We should empty the link
                const freeStorage = storage.store.getFreeCapacity();
                const emptyNeeded = link.store.getUsedCapacity(RESOURCE_ENERGY);
                const possibleAmount = Math.min(freeStorage, emptyNeeded, this.creep.store.getCapacity());

                if (possibleAmount > 0) {
                    // We can do it

                    this.creep.withdraw(link, RESOURCE_ENERGY, possibleAmount);
                    this.creep.memory.roleData.targetId = storage.id;
                    return;
                }
            }
        }
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

                        this.creep.withdraw(storage, resource, possibleAmount);
                        this.creep.memory.roleData.targetId = terminal.id;
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

                        this.creep.withdraw(terminal, resource, possibleAmount);
                        this.creep.memory.roleData.targetId = storage.id;
                        return;
                    }
                }
            }
        }

        const fillTargets: (StructureTower | StructureSpawn)[] = room.find(FIND_MY_STRUCTURES, {
            filter: (s) =>
                (s.structureType === STRUCTURE_TOWER || s.structureType === STRUCTURE_SPAWN) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        }) as (StructureTower | StructureSpawn)[];

        if (fillTargets.length > 0 && storage !== undefined) {
            const storageAmount: number = storage.store.getUsedCapacity(RESOURCE_ENERGY);
            const fillNeeded: number = fillTargets[0].store.getFreeCapacity(RESOURCE_ENERGY);
            const possibleAmount = Math.min(storageAmount, fillNeeded, this.creep.store.getCapacity());
            if (possibleAmount > 0) {
                this.creep.withdraw(storage, RESOURCE_ENERGY, possibleAmount);
                this.creep.memory.roleData.targetId = fillTargets[0].id;
                return;
            }
        }
    }
}
