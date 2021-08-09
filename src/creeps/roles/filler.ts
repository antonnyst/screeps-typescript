import { setMovementData } from "creeps/creep";
import { BuildingData } from "managers/roomManager/layoutHandler";

export interface FillerMemory extends CreepMemory {
    tasks?: Task[];
}

interface Task {
    type: "transfer" | "withdraw" | "pickup";
    id: Id<AnyStoreStructure | Tombstone | Ruin | Resource>;
    resourceType?: ResourceConstant;
    amount?: number;
    pos?: number;
}

interface GetTaskData {
    resources: ResourceConstant[];
    fn: GetTaskFunction;
}

type GetTaskFunction = (creep: Creep) => Task[] | null;

const FillerIgnoreExtensions: Partial<Record<number, number[]>> = {
    7: [5, 8, 9],
    8: [5, 8, 9, 12]
};

export function filler(creep: Creep): void {
    const memory = creep.memory as FillerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }

    memory.tasks = memory.tasks || [];

    if (memory.tasks.length === 0) {
        memory.tasks = getTasks(creep);
    }

    doTasks(creep);
}

function getTasks(creep: Creep): Task[] {
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return [];
    }

    if (creep.store.getUsedCapacity() === 0) {
        for (const getter of taskGetters) {
            const res = getter.fn(creep);
            if (res !== null) {
                return res;
            }
        }
    }

    if (home.memory.genBuildings.storage.id !== undefined) {
        const storage = Game.getObjectById(home.memory.genBuildings.storage.id);
        if (storage instanceof StructureStorage) {
            const tasks: Task[] = [];
            for (const key of Object.keys(creep.store)) {
                const amt = creep.store.getUsedCapacity(key as ResourceConstant);
                tasks.push({
                    type: "transfer",
                    id: storage.id,
                    resourceType: key as ResourceConstant,
                    amount: amt
                });
            }
            return tasks;
        }
    }

    return [];
}

function doTasks(creep: Creep): void {
    const memory = creep.memory as FillerMemory;
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return;
    }

    if (memory.tasks === undefined || memory.tasks.length === 0) {
        setMovementData(creep, {
            pos: new RoomPosition(home.memory.genLayout!.prefabs[0].x, home.memory.genLayout!.prefabs[0].y, home.name),
            range: 4
        });
        return;
    }

    const task = memory.tasks[0];

    const object = Game.getObjectById(task.id);
    if (object === null) {
        memory.tasks.shift();
        return;
    }

    setMovementData(creep, {
        pos: object.pos,
        range: 1
    });

    if (creep.pos.isNearTo(object.pos)) {
        if (task.type === "pickup" && object instanceof Resource) {
            creep.pickup(object);
            memory.tasks.shift();
        } else if (
            task.type === "withdraw" &&
            (object instanceof StructureStorage || object instanceof StructureContainer) &&
            task.resourceType !== undefined
        ) {
            creep.withdraw(object, task.resourceType, task.amount);
            memory.tasks.shift();
        } else if (
            task.type === "transfer" &&
            (object instanceof StructureStorage ||
                object instanceof StructureContainer ||
                object instanceof StructureSpawn ||
                object instanceof StructureExtension ||
                object instanceof StructureTower) &&
            task.resourceType !== undefined
        ) {
            creep.transfer(object, task.resourceType, task.amount);
            memory.tasks.shift();
        } else {
            console.log("task error");
            console.log(JSON.stringify(task));
            memory.tasks.shift();
        }
    }
}

function getEnergy(creep: Creep, amount: number): Task[] | null {
    const home = Game.rooms[creep.memory.home];
    if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
        return [];
    }
    let amountLeft: number = amount;
    const tasks: Task[] = [];

    const energySources: (StructureStorage | StructureContainer | Resource)[] = home.find(FIND_DROPPED_RESOURCES, {
        filter: (r) => r.resourceType === RESOURCE_ENERGY
    }) as (StructureStorage | StructureContainer | Resource)[];

    if (home.memory.genBuildings.storage.id !== undefined) {
        const object = Game.getObjectById(home.memory.genBuildings.storage.id);
        if (object instanceof StructureStorage) {
            energySources.push(object);
        }
    }
    for (const container of home.memory.genBuildings.containers) {
        if (container.id !== undefined) {
            const object = Game.getObjectById(container.id);
            if (object instanceof StructureContainer) {
                energySources.push(object);
            }
        }
    }

    energySources.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));

    while (energySources.length > 0) {
        if (amountLeft === 0) {
            break;
        }

        const energySource = energySources.shift();
        if (energySource instanceof StructureStorage || energySource instanceof StructureContainer) {
            const amt = Math.min(amountLeft, energySource.store.getUsedCapacity(RESOURCE_ENERGY));
            if (amt > 0) {
                amountLeft -= amt;
                tasks.push({
                    id: energySource.id,
                    type: "withdraw",
                    amount: amt
                });
            }
        } else if (energySource instanceof Resource && energySource.resourceType === RESOURCE_ENERGY) {
            const amt = Math.min(amountLeft, energySource.amount - 30);
            if (amt > 0) {
                amountLeft -= amt;
                tasks.push({
                    id: energySource.id,
                    type: "pickup",
                    amount: amt
                });
            }
        }
    }

    if (amountLeft > 0) {
        return null;
    }

    return tasks;
}

const taskGetters: GetTaskData[] = [
    {
        // Fill towers
        resources: [RESOURCE_ENERGY],
        fn: (creep: Creep): Task[] | null => {
            const home = Game.rooms[creep.memory.home];
            if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
                return null;
            }
            const targets: StructureTower[] = [];
            for (const tower of home.memory.genBuildings.towers) {
                if (tower.id !== undefined) {
                    const object = Game.getObjectById(tower.id);
                    if (object instanceof StructureTower) {
                        targets.push(object);
                    }
                }
            }
            let capacity: number = creep.store.getCapacity();
            let fill: number = 0;
            const fillTargets: StructureTower[] = [];
            while (targets.length > 0) {
                if (fill === capacity) {
                    break;
                }
                const tower = targets.pop();
                if (tower !== undefined) {
                    if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const amt = Math.min(capacity - fill, tower.store.getFreeCapacity(RESOURCE_ENERGY));
                        if (amt > 0) {
                            fill += amt;
                            fillTargets.push(tower);
                        }
                    }
                }
            }
            if (fill === 0) {
                return null;
            }
            let tasks: Task[] = [];
            fill -= creep.store.getUsedCapacity(RESOURCE_ENERGY);
            if (fill > 0) {
                let energyTasks: Task[] | null = getEnergy(creep, fill);
                if (energyTasks !== null) {
                    tasks = tasks.concat(energyTasks);
                }
            }

            for (const tower of fillTargets) {
                tasks.push({
                    id: tower.id,
                    type: "transfer"
                });
            }

            return tasks;
        }
    },
    {
        // Fill spawns and extensions
        resources: [RESOURCE_ENERGY],
        fn: (creep: Creep): Task[] | null => {
            const home = Game.rooms[creep.memory.home];
            const controller = home.controller;
            if (
                controller === undefined ||
                home.memory.genLayout === undefined ||
                home.memory.genBuildings === undefined
            ) {
                return null;
            }
            const targets: (StructureSpawn | StructureExtension)[] = ([] as (
                | StructureSpawn
                | StructureExtension
            )[]).concat(
                GetEnergyBuildings(home.memory.genBuildings.spawns) as StructureSpawn[],
                GetEnergyBuildings(
                    home.memory.genBuildings.extensions,
                    FillerIgnoreExtensions[controller.level]
                ) as StructureExtension[]
            );

            let capacity: number = creep.store.getCapacity();
            let fill: number = 0;
            const fillTargets: (StructureSpawn | StructureExtension)[] = [];
            while (targets.length > 0) {
                if (fill === capacity) {
                    break;
                }
                const target = targets.pop();
                if (target !== undefined) {
                    if (target.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const amt = Math.min(capacity - fill, target.store.getFreeCapacity(RESOURCE_ENERGY));
                        if (amt > 0) {
                            fill += amt;
                            fillTargets.push(target);
                        }
                    }
                }
            }
            if (fill === 0) {
                return null;
            }
            let tasks: Task[] = [];
            fill -= creep.store.getUsedCapacity(RESOURCE_ENERGY);
            if (fill > 0) {
                let energyTasks: Task[] | null = getEnergy(creep, fill);
                if (energyTasks !== null) {
                    tasks = tasks.concat(energyTasks);
                }
            }

            for (const target of fillTargets) {
                tasks.push({
                    id: target.id,
                    type: "transfer"
                });
            }

            return tasks;
        }
    }
    //TODO: fill labs, nuker and powerspawn
];

function GetEnergyBuildings(buildings: BuildingData[], ignoreIndexes?: number[]): Structure[] {
    const structures: Structure[] = [];
    for (const [i, building] of buildings.entries()) {
        if (building.id !== undefined && !ignoreIndexes?.includes(i)) {
            const object = Game.getObjectById(building.id);
            if (
                (object instanceof StructureExtension ||
                    object instanceof StructureTower ||
                    object instanceof StructureSpawn) &&
                object.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            ) {
                structures.push(object);
            }
            if (object instanceof StructureLab && object.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                structures.push(object);
            }
        }
    }
    return structures;
}
