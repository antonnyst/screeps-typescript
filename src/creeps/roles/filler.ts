import { Building, Storage, Terminal } from "buildings";
import { baseCenter } from "utils/baseCenter";
import { isOwnedRoom } from "utils/RoomCalc";
import { setMovementData } from "creeps/creep";

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
      const capacity: number = creep.store.getCapacity();
      let fill = 0;
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
        const energyTasks: Task[] | null = getEnergy(creep, fill);
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
  },
  {
    // Fill labs
    resources: [],
    fn: (creep: Creep): Task[] | null => {
      const home = Game.rooms[creep.memory.home];
      const terminal = Terminal(home);
      if (
        !isOwnedRoom(home) ||
        home.memory.genLayout === undefined ||
        home.memory.genBuildings === undefined ||
        home.memory.labs === undefined ||
        home.memory.labs.status === "react" ||
        terminal === null
      ) {
        return null;
      }
      const tasks: Task[] = [];
      const capacity = creep.store.getCapacity();
      for (const labData of home.memory.labs.labs) {
        const labObject = Game.getObjectById(labData.id);
        if (labObject !== null) {
          if (labData.targetResource !== labObject.mineralType) {
            if (labObject.mineralType != null) {
              // Empty lab
              const amount = Math.min(capacity, labObject.store.getUsedCapacity(labObject.mineralType));
              tasks.push({
                type: "withdraw",
                id: labData.id,
                resourceType: labObject.mineralType,
                amount
              });
              tasks.push({
                type: "transfer",
                id: terminal.id,
                resourceType: labObject.mineralType,
                amount
              });
              return tasks;
            } else if (labObject.mineralType == null && labData.targetResource !== null) {
              // Fill lab
              const freeCapacity = labObject.store.getFreeCapacity(labData.targetResource);
              if (freeCapacity !== null) {
                const amount = Math.min(capacity, terminal.store.getUsedCapacity(labData.targetResource), freeCapacity);
                if (amount > 0) {
                  tasks.push({
                    type: "withdraw",
                    id: terminal.id,
                    resourceType: labData.targetResource,
                    amount
                  });
                  tasks.push({
                    type: "transfer",
                    id: labData.id,
                    resourceType: labData.targetResource,
                    amount
                  });
                  return tasks;
                }
              }
            }
          } else if (labObject.mineralType != null && labObject.store.getFreeCapacity(labObject.mineralType) > 0) {
            // Fill more in lab
            const freeCapacity = labObject.store.getFreeCapacity(labObject.mineralType);
            if (freeCapacity !== null) {
              const amount = Math.min(capacity, terminal.store.getUsedCapacity(labObject.mineralType), freeCapacity);
              if (amount > 0) {
                tasks.push({
                  type: "withdraw",
                  id: terminal.id,
                  resourceType: labObject.mineralType,
                  amount
                });
                tasks.push({
                  type: "transfer",
                  id: labData.id,
                  resourceType: labObject.mineralType,
                  amount
                });
                return tasks;
              }
            }
          }
        }
      }
      return null;
    }
  },
  {
    // Pickup tombstones
    resources: [],
    fn: (creep: Creep): Task[] | null => {
      const home = Game.rooms[creep.memory.home];
      const storage = Storage(home);
      if (!isOwnedRoom(home) || storage === null) {
        return null;
      }
      const tombstones = home.find(FIND_TOMBSTONES);
      for (const tombstone of tombstones) {
        if (tombstone.store.getUsedCapacity() > 0) {
          const tasks: Task[] = [];
          for (const resource of Object.keys(tombstone.store)) {
            tasks.push({
              type: "withdraw",
              id: tombstone.id,
              resourceType: resource as ResourceConstant,
              amount: tombstone.store.getUsedCapacity(resource as ResourceConstant)
            });
          }
          return tasks;
        }
      }
      return null;
    }
  }
  // TODO: fill nuker and powerspawn
];

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
        (object instanceof StructureStorage ||
          object instanceof StructureContainer ||
          object instanceof StructureTerminal ||
          object instanceof StructureLab ||
          object instanceof StructureTower ||
          object instanceof StructureSpawn ||
          object instanceof StructureExtension) &&
        task.resourceType !== undefined &&
        task.amount !== undefined
      ) {
        const freeCapacity = object.store.getFreeCapacity(task.resourceType);
        if (freeCapacity !== null && freeCapacity < task.amount) {
          memory.tasks.splice(i, 1);
          continue;
        }
      }
    }
  } else {
    const energyNeedBuildings = GetEnergyNeedBuildings(home);
    const closestNeed = creep.pos.findClosestByRange(energyNeedBuildings);
    let target: AnyStoreStructure | Tombstone | Resource | null = closestNeed;
    if (
      creep.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() * 0.25 &&
      energyNeedBuildings.length > 0
    ) {
      const energySupplyObjects = GetEnergySupplyObjects(home);
      const closestSupply = creep.pos.findClosestByRange(energySupplyObjects);
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
        if (target instanceof StructureStorage || target instanceof StructureContainer || target instanceof Tombstone) {
          creep.withdraw(target, RESOURCE_ENERGY);
        } else if (target instanceof Resource) {
          creep.pickup(target);
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

    if (creep.ticksToLive && creep.ticksToLive < 50) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (storage !== null) {
          setMovementData(creep, {
            pos: storage.pos,
            range: 1
          });
          if (creep.pos.isNearTo(storage)) {
            creep.transfer(storage, RESOURCE_ENERGY);
          }
          return;
        }
      }
    }

    if (
      creep.ticksToLive &&
      creep.ticksToLive > 50 &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getCapacity() * 0.25
    ) {
      const energySupplyObjects = GetEnergySupplyObjects(home).filter(
        a => !(a instanceof Structure) || a.structureType !== STRUCTURE_CONTAINER
      );
      const closestSupply = creep.pos.findClosestByRange(energySupplyObjects);
      if (closestSupply !== null) {
        setMovementData(creep, {
          pos: closestSupply.pos,
          range: 1
        });
        if (creep.pos.isNearTo(closestSupply)) {
          if (closestSupply instanceof Resource) {
            creep.pickup(closestSupply);
          } else {
            creep.withdraw(closestSupply, RESOURCE_ENERGY);
          }
        }
        return;
      }
    }

    const cPos = baseCenter(home);
    if (creep.pos.isEqualTo(cPos)) {
      setMovementData(creep, {
        pos: cPos,
        range: 2,
        flee: true
      });
    } else {
      setMovementData(creep, {
        pos: cPos,
        range: 3
      });
    }
  }
}

function getTasks(creep: Creep): Task[] {
  const home = Game.rooms[creep.memory.home];
  if (home.memory.genLayout === undefined || home.memory.genBuildings === undefined) {
    return [];
  }

  const storage = Storage(home);
  const carriedResources = Object.keys(creep.store) as ResourceConstant[];
  for (const getter of taskGetters) {
    const res = getter.fn(creep);
    if (res !== null) {
      let compatible = true;
      for (const resource of carriedResources) {
        if (!getter.resources.includes(resource)) {
          compatible = false;
          break;
        }
      }
      if (compatible) {
        return res;
      } else if (storage !== null) {
        for (const key of Object.keys(creep.store)) {
          const amt = creep.store.getUsedCapacity(key as ResourceConstant);
          res.unshift({
            type: "transfer",
            id: storage.id,
            resourceType: key as ResourceConstant,
            amount: amt
          });
        }
        return res;
      }
    }
  }

  if (storage !== null) {
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
      pos: new RoomPosition(home.memory.genLayout.prefabs[0].x, home.memory.genLayout.prefabs[0].y, home.name),
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
      (object instanceof StructureStorage ||
        object instanceof StructureContainer ||
        object instanceof StructureLab ||
        object instanceof StructureTerminal ||
        object instanceof Tombstone) &&
      task.resourceType !== undefined
    ) {
      creep.withdraw(object, task.resourceType, task.amount);
      memory.tasks.shift();
    } else if (
      task.type === "transfer" &&
      (object instanceof StructureStorage ||
        object instanceof StructureTerminal ||
        object instanceof StructureContainer ||
        object instanceof StructureSpawn ||
        object instanceof StructureExtension ||
        object instanceof StructureTower ||
        object instanceof StructureLab) &&
      task.resourceType !== undefined
    ) {
      creep.transfer(object, task.resourceType, task.amount);
      memory.tasks.shift();
    } else {
      console.log("task error");
      console.log(JSON.stringify(task));
      console.log(object);
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
    filter: r => r.resourceType === RESOURCE_ENERGY
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

// eslint-disable-next-line no-underscore-dangle
const _energyNeedBuildings: Partial<
  Record<string, { time: number; data: (StructureExtension | StructureSpawn | StructureLab)[] }>
> = {};

function GetEnergyNeedBuildings(room: Room) {
  if (_energyNeedBuildings[room.name] !== undefined && _energyNeedBuildings[room.name]?.time === Game.time) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

// eslint-disable-next-line no-underscore-dangle
const _energySupplyObjects: Partial<
  Record<string, { time: number; data: (StructureStorage | StructureContainer | Tombstone | Resource)[] }>
> = {};

function GetEnergySupplyObjects(room: Room) {
  if (_energySupplyObjects[room.name] !== undefined && _energySupplyObjects[room.name]?.time === Game.time) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return _energySupplyObjects[room.name]!.data;
  }
  if (room.memory.genBuildings === undefined || room.controller === undefined) {
    return [];
  }
  const objects = [];

  const storage = Storage(room);
  if (storage !== null && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
    objects.push(storage);
  }

  for (const building of room.memory.genBuildings.containers) {
    if (building.id !== undefined) {
      const object = Game.getObjectById(building.id);
      if (object instanceof StructureContainer && object.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        objects.push(object);
      }
    }
  }

  const resources = room.find(FIND_DROPPED_RESOURCES, {
    filter: s => s.resourceType === RESOURCE_ENERGY && s.amount > 50
  });
  for (const resource of resources) {
    objects.push(resource);
  }

  const tombstones = room.find(FIND_TOMBSTONES, {
    filter: s => s.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  });
  for (const tombstone of tombstones) {
    objects.push(tombstone);
  }

  _energySupplyObjects[room.name] = {
    time: Game.time,
    data: objects
  };
  return objects;
}
