import { PowerSpawn } from "buildings";

declare global {
  interface OwnedRoomMemory {
    power?: {
      process: boolean;
    };
  }
}

/**
 * Makes the power spawn process power if it should
 * @param room The owned room to run the handler on
 */
export function PowerHandler(room: OwnedRoom): void {
  if (room.memory.power === undefined) {
    room.memory.power = { process: false };
  }
  if (room.memory.power.process) {
    const powerSpawn = PowerSpawn(room);
    if (
      powerSpawn !== null &&
      powerSpawn.store.getUsedCapacity(RESOURCE_POWER) > 0 &&
      powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 50
    ) {
      powerSpawn.processPower();
    }
  }
}
