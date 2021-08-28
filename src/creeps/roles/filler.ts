import { Building, Storage } from "buildings";
import { setMovementData } from "creeps/creep";
import { baseCenter } from "utils/baseCenter";

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
    7: [5],
    8: [5, 10]
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

    if (memory.tasks.length > 0) {
        doTasks(creep);

        for (let i = memory.tasks.length - 1; i >= 0; i--) {
            const task = memory.tasks[i];
            const object = Game.getObjectById(task.id);
            if (object === null) {
                memory.tasks.splice(i, 1);
                continue;
            }
            if (
                task.type === "transfer" &&
                (object instanceof StructureStorage || object instanceof StructureContainer) &&
                task.resourceType !== undefined &&
                task.amount !== undefined
            ) {
                if (
                    object.store.getFreeCapacity(task.resourceType) !== null &&
                    object.store.getFreeCapacity(task.resourceType)! < task.amount
                ) {
                    memory.tasks.splice(i, 1);
                    continue;
                }
            }
            if (
                task.type === "transfer" &&
                (object instanceof StructureTower ||
                    object instanceof StructureSpawn ||
                    object instanceof StructureExtension) &&
                task.resourceType !== undefined &&
                task.amount !== undefined
            ) {
                if (
                    object.store.getFreeCapacity(task.resourceType) !== null &&
                    object.store.getFreeCapacity(task.resourceType)! < task.amount
                ) {
                    memory.tasks.splice(i, 1);
                    continue;
                }
            }
        }
    } else {
        const energyNeedBuildings = GetEnergyNeedBuildings(home);
        const closestNeed = creep.pos.findClosestByRange(energyNeedBuildings);
        let target: AnyStoreStructure | null = closestNeed;
        if (
            creep.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() * 0.25 &&
            energyNeedBuildings.length > 0
        ) {
            const energySupplyBuildings = GetEnergySupplyBuildings(home);
            const closestSupply = creep.pos.findClosestByRange(energySupplyBuildings);
            if (
                target === null ||
                creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 ||
                (closestSupply !== null && closestSupply.pos.getRangeTo(creep) < target.pos.getRangeTo(creep))
            ) {
                target = closestSupply;
            }
        }

        if (target !== null) {
            setMovementData(creep, {
                pos: target.pos,
                range: 1
            });
            if (creep.pos.isNearTo(target)) {
                if (target instanceof StructureStorage || target instanceof StructureContainer) {
                    creep.withdraw(target, RESOURCE_ENERGY);
                } else {
                    creep.transfer(target, RESOURCE_ENERGY);
                }
            }
            return;
        }

        const storage = Storage(home);
        if (storage !== null && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
            const qfContainers = [Building(home.memory.genBuildings.containers[0])].concat(
                Building(home.memory.genBuildings.containers[1])
            );
            let target = null;
            for (const container of qfContainers) {
                if (
                    container !== null &&
                    container instanceof StructureContainer &&
                    container.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                ) {
                    target = container;
                    break;
                }
            }
            if (target !== null) {
                if (
                    creep.store.getUsedCapacity(RESOURCE_ENERGY) < target.store.getFreeCapacity(RESOURCE_ENERGY) &&
                    creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                ) {
                    setMovementData(creep, {
                        pos: storage.pos,
                        range: 1
                    });
                    if (creep.pos.isNearTo(storage)) {
                        creep.withdraw(storage, RESOURCE_ENERGY);
                    }
                } else {
                    setMovementData(creep, {
                        pos: target.pos,
                        range: 1
                    });
                    if (creep.pos.isNearTo(target)) {
                        creep.transfer(target, RESOURCE_ENERGY);
                    }
                }
                return;
            }
        }

        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() * 0.25) {
            const energySupplyBuildings = GetEnergySupplyBuildings(home).filter(
                (a) => a.structureType !== STRUCTURE_CONTAINER
            );
            const closestSupply = creep.pos.findClosestByRange(energySupplyBuildings);
            if (closestSupply !== null) {
                setMovementData(creep, {
                    pos: closestSupply.pos,
                    range: 1
                });
                if (creep.pos.isNearTo(closestSupply)) {
                    creep.withdraw(closestSupply, RESOURCE_ENERGY);
                }
                return;
            }
        }

        setMovementData(creep, {
            pos: baseCenter(home),
            range: 3
        });
    }
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
    } else {
        const carriedResources = Object.keys(creep.store) as ResourceConstant[];
        for (const getter of taskGetters) {
            let compatible = true;
            for (const resource of carriedResources) {
                if (!getter.resources.includes(resource)) {
                    compatible = false;
                    break;
                }
            }
            if (compatible) {
                const res = getter.fn(creep);
                if (res !== null) {
                    return res;
                }
            }
        }
    }

    if (home.memory.genBuildings.storage.id !== undefined) {
        const storage = Game.getObjectById(home.memory.genBuildings.storage.id);
        if (storage instanceof StructureStorage) {
            const tasks: Task[] = [];
            for (const key of Object.keys(creep.store)) {
                if (key === RESOURCE_ENERGY) {
                    continue;
                }
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
        pos: task.pos || object.pos,
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
                    amount: amt,
                    resourceType: RESOURCE_ENERGY
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
                    type: "transfer",
                    resourceType: RESOURCE_ENERGY
                });
            }

            return tasks;
        }
    }
    //TODO: fill labs, nuker and powerspawn
];

const _energyNeedBuildings: Partial<
    Record<string, { time: number; data: (StructureExtension | StructureSpawn | StructureLab)[] }>
> = {};

function GetEnergyNeedBuildings(room: Room) {
    if (_energyNeedBuildings[room.name] !== undefined && _energyNeedBuildings[room.name]?.time === Game.time) {
        return _energyNeedBuildings[room.name]!.data;
    }

    if (room.memory.genBuildings === undefined || room.controller === undefined) {
        return [];
    }
    const structures = [];
    for (const [i, building] of room.memory.genBuildings.extensions.entries()) {
        if (
            building.id !== undefined &&
            (FillerIgnoreExtensions[room.controller.level] === undefined ||
                !FillerIgnoreExtensions[room.controller.level]!.includes(i))
        ) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureExtension && object.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                structures.push(object);
            }
        }
    }
    for (const building of room.memory.genBuildings.spawns) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureSpawn && object.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                structures.push(object);
            }
        }
    }
    for (const building of room.memory.genBuildings.labs) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureLab && object.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                structures.push(object);
            }
        }
    }
    _energyNeedBuildings[room.name] = {
        time: Game.time,
        data: structures
    };
    return structures;
}

const _energySupplyBuildings: Partial<
    Record<string, { time: number; data: (StructureStorage | StructureContainer)[] }>
> = {};

function GetEnergySupplyBuildings(room: Room) {
    if (_energySupplyBuildings[room.name] !== undefined && _energySupplyBuildings[room.name]?.time === Game.time) {
        return _energySupplyBuildings[room.name]!.data;
    }

    if (room.memory.genBuildings === undefined || room.controller === undefined) {
        return [];
    }
    const structures = [];

    const storage = Storage(room);
    if (storage !== null && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        structures.push(storage);
    }

    for (const building of room.memory.genBuildings.containers) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureContainer && object.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                structures.push(object);
            }
        }
    }
    _energySupplyBuildings[room.name] = {
        time: Game.time,
        data: structures
    };
    return structures;
}
