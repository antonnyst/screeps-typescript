import { setMovementData } from "../creep";

export interface TransporterMemory extends CreepMemory {
  sourceRoom: string;
  sourceStore?: Id<StructureStorage | StructureContainer | StructureTerminal | StructureFactory>;
  targetRoom: string;
  targetStore: Id<StructureStorage | StructureContainer | StructureTerminal | StructureFactory>;
  resource?: ResourceConstant;
  pickup?: boolean;
}

export function transporter(creep: Creep): void {
  const memory = creep.memory as TransporterMemory;

  if (memory.pickup && creep.store.getFreeCapacity() === 0) {
    memory.pickup = false;
  }
  if (!memory.pickup && creep.store.getUsedCapacity() === 0) {
    memory.pickup = true;
  }

  if (memory.pickup) {
    if (creep.room.name !== memory.sourceRoom) {
      setMovementData(creep, {
        pos: new RoomPosition(25, 25, memory.sourceRoom),
        range: 20
      });
    } else {
      if (memory.sourceStore === undefined) {
        const stores = creep.room.find(FIND_STRUCTURES, {
          filter: s =>
            (s.structureType === STRUCTURE_STORAGE ||
              s.structureType === STRUCTURE_FACTORY ||
              s.structureType === STRUCTURE_CONTAINER ||
              s.structureType === STRUCTURE_TERMINAL) &&
            s.store.getUsedCapacity() > 0
        });
        memory.sourceStore = stores[0].id as Id<
          StructureStorage | StructureContainer | StructureTerminal | StructureFactory
        >;
      } else {
        const source = Game.getObjectById(memory.sourceStore);
        if (source !== null) {
          if (creep.pos.isNearTo(source)) {
            if (source.store.getUsedCapacity() === 0) {
              memory.pickup = false;
            } else {
              let resource = memory.resource;
              if (!resource) {
                resource = Object.keys(source.store)[0] as ResourceConstant;
              }
              creep.withdraw(source, resource);
            }
          } else {
            setMovementData(creep, {
              pos: source.pos,
              range: 1
            });
          }
        }
      }
    }
  } else {
    if (creep.room.name !== memory.targetRoom) {
      setMovementData(creep, {
        pos: new RoomPosition(25, 25, memory.targetRoom),
        range: 20
      });
    } else {
      const target = Game.getObjectById(memory.targetStore);
      if (target !== null) {
        if (creep.pos.isNearTo(target)) {
          let resource = memory.resource;
          if (!resource) {
            resource = Object.keys(creep.store)[0] as ResourceConstant;
          }
          creep.transfer(target, resource);
        } else {
          setMovementData(creep, {
            pos: target.pos,
            range: 1
          });
        }
      }
    }
  }
}
