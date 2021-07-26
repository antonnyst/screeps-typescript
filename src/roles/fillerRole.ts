import { CreepRole } from "./creepRole";
import { saveToCache, getFromCache } from "../utils/Cache";
import { unpackPosition } from "../utils/RoomPositionPacker";
import { EXTRA_ENERGY_FILL_ENERGY_NEEDED } from "config/constants";
import { LabHandler } from "managers/roomManager/labHandler";

declare global {
    interface CreepMemory {
        filler?: {
            transfer: TransferTask[];
            withdraw: WithdrawTask[];
            pickup: PickupTask[];
            cooldown: number;
        };
    }
}
interface TransferTask {
    id: Id<AnyStoreStructure>;
    resourceType: ResourceConstant;
    amount: number;
}
interface WithdrawTask {
    id: Id<AnyStoreStructure | Tombstone | Ruin>;
    resourceType: ResourceConstant;
    amount: number;
}
interface PickupTask {
    id: Id<Resource>;
}

const FillerCooldown = 5;

export class FillerRole extends CreepRole {
    runRole() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.memory.filler === undefined) {
            this.creep.memory.filler = {
                transfer: [],
                withdraw: [],
                pickup: [],
                cooldown: 0
            };
        }

        this.creep.memory.filler.cooldown -= 1;

        if (
            this.creep.memory.filler.transfer.length > 0 &&
            this.creep.memory.filler.withdraw.length === 0 &&
            this.creep.memory.filler.pickup.length === 0 &&
            this.creep.store.getUsedCapacity() === 0
        ) {
            this.creep.memory.filler.transfer = [];
        }

        if (
            this.creep.memory.filler.pickup.length === 0 &&
            this.creep.memory.filler.withdraw.length === 0 &&
            this.creep.memory.filler.transfer.length === 0 &&
            this.creep.memory.filler.cooldown <= 0
        ) {
            this.findActions();
        }
        this.doAction(false);
    }
    doAction(follow: boolean): void {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.filler === undefined) {
            this.creep.memory.filler = {
                transfer: [],
                withdraw: [],
                pickup: [],
                cooldown: 0
            };
        }

        const pickup: boolean = this.creep.memory.filler.pickup.length > 0;
        const withdraw: boolean = this.creep.memory.filler.withdraw.length > 0;
        const transfer: boolean = this.creep.memory.filler.transfer.length > 0;

        if (pickup) {
            const resource: Resource | null = Game.getObjectById(this.creep.memory.filler.pickup[0].id);
            if (resource !== null && resource !== undefined) {
                this.setMovementData(resource.pos, 1, false, false);
                if (this.creep.pos.isNearTo(resource.pos) && !follow) {
                    this.creep.pickup(resource);
                    this.creep.memory.filler.pickup.shift();
                    this.doAction(true);
                }
            } else {
                this.creep.memory.filler.pickup.shift();
                this.doAction(true);
            }
        } else if (withdraw) {
            const structure: AnyStoreStructure | Tombstone | Ruin | null = Game.getObjectById<
                AnyStoreStructure | Tombstone | Ruin
            >(this.creep.memory.filler.withdraw[0].id);
            if (structure !== null) {
                this.setMovementData(structure.pos, 1, false, false);
                if (this.creep.pos.isNearTo(structure.pos) && !follow) {
                    this.creep.withdraw(
                        structure,
                        this.creep.memory.filler.withdraw[0].resourceType,
                        this.creep.memory.filler.withdraw[0].amount
                    );
                    this.creep.memory.filler.withdraw.shift();
                    this.doAction(true);
                }
            } else {
                this.creep.memory.filler.withdraw.shift();
                this.doAction(true);
            }
        } else if (transfer) {
            const structure: AnyStoreStructure | null = Game.getObjectById<AnyStoreStructure>(
                this.creep.memory.filler.transfer[0].id
            );
            if (structure !== null) {
                this.setMovementData(structure.pos, 1, false, false);
                if (this.creep.pos.isNearTo(structure.pos) && !follow) {
                    this.creep.transfer(
                        structure,
                        this.creep.memory.filler.transfer[0].resourceType,
                        this.creep.memory.filler.transfer[0].amount
                    );
                    this.creep.memory.filler.transfer.shift();
                    this.doAction(true);
                }
            } else {
                this.creep.memory.filler.transfer.shift();
                this.doAction(true);
            }
        } else {
            this.setMovementData(
                new RoomPosition(
                    this.creep.room.memory.genLayout!.prefabs[0].x,
                    this.creep.room.memory.genLayout!.prefabs[0].y,
                    this.creep.room.name
                ),
                4,
                false,
                false
            );
        }
    }
    findActions(): void {
        if (this.creep === null) {
            return;
        }
        if (this.creep.memory.filler === undefined) {
            this.creep.memory.filler = {
                transfer: [],
                withdraw: [],
                pickup: [],
                cooldown: 0
            };
        }
        const energyStructures: (
            | StructureSpawn
            | StructureExtension
            | StructureTower
            | StructureLab
        )[] = this.creep.room.find(FIND_MY_STRUCTURES, {
            filter: (s) =>
                ((s.structureType === STRUCTURE_TOWER || s.structureType === STRUCTURE_EXTENSION) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                (s.structureType === STRUCTURE_SPAWN && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                (s.structureType === STRUCTURE_LAB && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        }) as (StructureSpawn | StructureExtension | StructureTower | StructureLab)[];

        // check leftover resources

        let energyLeftover = false;

        if (this.creep.store.getUsedCapacity() > 0) {
            if (
                energyStructures.length > 0 &&
                this.creep.store.getUsedCapacity(RESOURCE_ENERGY) === this.creep.store.getUsedCapacity()
            ) {
                // we only have leftover energy
                energyLeftover = true;
            } else {
                if (this.creep.room.storage !== undefined) {
                    for (const key of Object.keys(this.creep.store)) {
                        const amt = this.creep.store.getUsedCapacity(key as ResourceConstant);
                        this.creep.memory.filler.transfer.push({
                            id: this.creep.room.storage.id,
                            resourceType: key as ResourceConstant,
                            amount: amt
                        });
                    }
                } else {
                    //console.log("Filler Creep: stray resources but no storage");
                }
                return;
            }
        }

        // fill energy
        if (energyStructures.length > 0) {
            energyStructures.sort((a, b) => a.pos.getRangeTo(this.creep!.pos) - b.pos.getRangeTo(this.creep!.pos));
            let spaceLeft: number =
                energyLeftover === true
                    ? this.creep.store.getUsedCapacity(RESOURCE_ENERGY)
                    : this.creep.store.getCapacity();
            const transfers: TransferTask[] = [];

            for (let i = 0; i < energyStructures.length; i++) {
                let amt: number = 0;

                if (energyStructures[i] instanceof StructureLab) {
                    amt = (energyStructures[i] as StructureLab).store.getFreeCapacity(RESOURCE_ENERGY);
                } else {
                    amt = (energyStructures[i] as
                        | StructureSpawn
                        | StructureExtension
                        | StructureTower).store.getFreeCapacity(RESOURCE_ENERGY);
                }

                if (amt > spaceLeft) {
                    amt = spaceLeft;
                }

                if (amt <= spaceLeft) {
                    transfers.push({
                        id: energyStructures[i].id,
                        resourceType: RESOURCE_ENERGY,
                        amount: amt
                    });
                    spaceLeft -= amt;
                }
                if (spaceLeft === 0) {
                    break;
                }
            }

            let energyNeed: number = energyLeftover === true ? 0 : this.creep.store.getCapacity() - spaceLeft;
            const pickups: PickupTask[] = [];
            const resources: Resource[] = this.creep.room.find(FIND_DROPPED_RESOURCES, {
                filter: (dr) => dr.resourceType === RESOURCE_ENERGY
            });

            for (let i = 0; i < resources.length; i++) {
                if (energyNeed === 0) {
                    break;
                }
                const amt: number = Math.min(resources[i].amount, energyNeed);
                energyNeed -= amt;
                pickups.push({
                    id: resources[i].id
                });
            }

            const withdraws: WithdrawTask[] = [];
            const structures: (StructureContainer | StructureStorage | StructureTerminal)[] = this.creep.room.find(
                FIND_STRUCTURES,
                {
                    filter: (s) =>
                        (s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_STORAGE ||
                            s.structureType === STRUCTURE_TERMINAL) &&
                        s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
                }
            ) as (StructureContainer | StructureStorage | StructureTerminal)[];
            structures.sort((a, b) => a.pos.getRangeTo(this.creep!.pos) - b.pos.getRangeTo(this.creep!.pos));
            for (let i = 0; i < structures.length; i++) {
                if (energyNeed === 0) {
                    break;
                }
                const amt: number = Math.min(structures[i].store.getUsedCapacity(RESOURCE_ENERGY), energyNeed);
                energyNeed -= amt;
                withdraws.push({
                    id: structures[i].id,
                    resourceType: RESOURCE_ENERGY,
                    amount: amt
                });
            }

            this.creep.memory.filler = {
                transfer: transfers,
                withdraw: withdraws,
                pickup: pickups,
                cooldown: 0
            };
            return;
        }

        // fill nuker
        if (
            this.creep.room.controller?.level === 8 &&
            this.creep.room.memory.resources?.total[RESOURCE_ENERGY] !== undefined &&
            this.creep.room.memory.resources?.total[RESOURCE_ENERGY] >= EXTRA_ENERGY_FILL_ENERGY_NEEDED &&
            this.creep.room.memory.genBuildings?.nuker.id !== undefined &&
            this.creep.room.memory.genBuildings?.terminal.id !== undefined
        ) {
            const nuker = Game.getObjectById(this.creep.room.memory.genBuildings?.nuker.id);
            const terminal = Game.getObjectById(this.creep.room.memory.genBuildings?.terminal.id);
            if (
                nuker !== null &&
                nuker instanceof StructureNuker &&
                nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                terminal !== null &&
                terminal instanceof StructureTerminal
            ) {
                const energyNeeded = nuker.store.getFreeCapacity(RESOURCE_ENERGY);
                const energySupply = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
                const capacity = this.creep.store.getFreeCapacity();

                const transferAmount = Math.min(energyNeeded, energySupply, capacity);

                this.creep.memory.filler = {
                    transfer: [
                        {
                            id: nuker.id,
                            resourceType: RESOURCE_ENERGY,
                            amount: transferAmount
                        }
                    ],
                    withdraw: [
                        {
                            id: terminal.id,
                            resourceType: RESOURCE_ENERGY,
                            amount: transferAmount
                        }
                    ],
                    pickup: [],
                    cooldown: 0
                };

                return;
            }
        }

        // fill powerspawn
        if (
            this.creep.room.controller?.level === 8 &&
            this.creep.room.memory.resources?.total[RESOURCE_ENERGY] !== undefined &&
            this.creep.room.memory.resources?.total[RESOURCE_ENERGY] >= EXTRA_ENERGY_FILL_ENERGY_NEEDED &&
            this.creep.room.memory.genBuildings?.powerspawn.id !== undefined &&
            this.creep.room.memory.genBuildings?.terminal.id !== undefined
        ) {
            const powerspawn = Game.getObjectById(this.creep.room.memory.genBuildings?.powerspawn.id);
            const terminal = Game.getObjectById(this.creep.room.memory.genBuildings?.terminal.id);
            if (
                powerspawn !== null &&
                powerspawn instanceof StructurePowerSpawn &&
                powerspawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                terminal !== null &&
                terminal instanceof StructureTerminal
            ) {
                const energyNeeded = powerspawn.store.getFreeCapacity(RESOURCE_ENERGY);
                const energySupply = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
                const capacity = this.creep.store.getFreeCapacity();

                const transferAmount = Math.min(energyNeeded, energySupply, capacity);

                this.creep.memory.filler = {
                    transfer: [
                        {
                            id: powerspawn.id,
                            resourceType: RESOURCE_ENERGY,
                            amount: transferAmount
                        }
                    ],
                    withdraw: [
                        {
                            id: terminal.id,
                            resourceType: RESOURCE_ENERGY,
                            amount: transferAmount
                        }
                    ],
                    pickup: [],
                    cooldown: 0
                };

                return;
            }
        }

        if (
            this.creep.room.memory.labs &&
            this.creep.room.memory.labs.status !== "react" &&
            this.creep.room.memory.genBuildings?.terminal.id !== undefined
        ) {
            for (const labData of this.creep.room.memory.labs?.labs) {
                const lab: StructureLab | null = Game.getObjectById<StructureLab>(labData.id);
                if (lab !== null) {
                    //Empty a lab
                    if (lab.mineralType != undefined && lab.mineralType !== labData.targetResource) {
                        const terminal = Game.getObjectById(this.creep.room.memory.genBuildings?.terminal.id);
                        if (terminal instanceof StructureTerminal) {
                            const creepCapactiy = this.creep.store.getFreeCapacity();
                            const terminalCapacity = terminal.store.getFreeCapacity();
                            const emptyNeeded = lab.store.getUsedCapacity(lab.mineralType);

                            const transferAmount = Math.min(creepCapactiy, terminalCapacity, emptyNeeded);

                            if (transferAmount > 0) {
                                this.creep.memory.filler = {
                                    transfer: [
                                        {
                                            id: terminal.id,
                                            resourceType: lab.mineralType,
                                            amount: transferAmount
                                        }
                                    ],
                                    withdraw: [
                                        {
                                            id: labData.id,
                                            resourceType: lab.mineralType,
                                            amount: transferAmount
                                        }
                                    ],
                                    pickup: [],
                                    cooldown: 0
                                };
                                return;
                            }
                        }
                    }

                    //Fill a lab
                    if (
                        (lab.mineralType == undefined && labData.targetResource !== null) ||
                        (lab.mineralType != null &&
                            lab.mineralType == labData.targetResource &&
                            lab.store.getFreeCapacity(lab.mineralType) > 0)
                    ) {
                        const terminal = Game.getObjectById(this.creep.room.memory.genBuildings?.terminal.id);
                        if (terminal instanceof StructureTerminal) {
                            const creepCapactiy = this.creep.store.getFreeCapacity();
                            const terminalAmount = terminal.store.getUsedCapacity(labData.targetResource);
                            const fillNeeded = lab.store.getFreeCapacity(labData.targetResource);

                            if (fillNeeded !== null) {
                                const transferAmount = Math.min(creepCapactiy, terminalAmount, fillNeeded);
                                if (transferAmount > 0) {
                                    this.creep.memory.filler = {
                                        transfer: [
                                            {
                                                id: labData.id,
                                                resourceType: labData.targetResource,
                                                amount: transferAmount
                                            }
                                        ],
                                        withdraw: [
                                            {
                                                id: terminal.id,
                                                resourceType: labData.targetResource,
                                                amount: transferAmount
                                            }
                                        ],
                                        pickup: [],
                                        cooldown: 0
                                    };
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }

        this.creep.memory.filler = {
            transfer: [],
            withdraw: [],
            pickup: [],
            cooldown: FillerCooldown
        };
        return;
    }
}
