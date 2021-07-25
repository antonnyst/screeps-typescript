import { Manager } from "./manager";
import { unpackPosition } from "../utils/RoomPositionPacker";

export class DefenseManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        for (const room in Game.rooms) {
            RunTowers(Game.rooms[room]);
        }
    }
}

function RunTowers(room: Room): void {
    const towers: StructureTower[] = room.find(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    if (towers.length > 0) {
        const hostiles: Creep[] = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            const dangerousHostiles: Creep[] = _.filter(
                hostiles,
                (h: Creep) =>
                    h.getActiveBodyparts(WORK) ||
                    h.getActiveBodyparts(ATTACK) ||
                    h.getActiveBodyparts(RANGED_ATTACK) ||
                    h.getActiveBodyparts(HEAL) ||
                    h.getActiveBodyparts(CARRY) ||
                    (room.memory.hostiles[h.id] !== undefined && room.memory.hostiles[h.id].firstSeen < Game.time - 50)
            );
            const basePos: RoomPosition =
                room.memory.genLayout !== undefined
                    ? new RoomPosition(
                          room.memory.genLayout.prefabs[0].x,
                          room.memory.genLayout.prefabs[0].y,
                          room.name
                      )
                    : new RoomPosition(25, 25, room.name);

            const target: Creep | null = basePos.findClosestByRange(dangerousHostiles);

            if (target != null) {
                towers.forEach((tower) => {
                    tower.attack(target);
                });
            }
        } else {
            const friendlyHealTargets: Creep[] = room.find(FIND_MY_CREEPS, {
                filter: (c) => c.hits < c.hitsMax
            });

            const basePos: RoomPosition =
                room.memory.genLayout !== undefined
                    ? new RoomPosition(
                          room.memory.genLayout.prefabs[0].x,
                          room.memory.genLayout.prefabs[0].y,
                          room.name
                      )
                    : new RoomPosition(25, 25, room.name);
            const target: Creep | null = basePos.findClosestByRange(friendlyHealTargets);

            if (target != null) {
                towers.forEach((tower) => {
                    tower.heal(target);
                });
            }
        }
    }
}

// ######## Defense manager ########
// Split into tower defense and creep defense
// There is also some common calculation done beforehand to be used by towers and creeps

// # STEPS #
// Gather data (DefenseData interface) potential heal, potential damage etc
// Run tower defense
// Run creep defense

// ##### Tower defense #####
// Run selected strategy for x ticks then change
// When no hostiles heal creeps

// # STRATEGIES #
// Strategies are randomly chosen and last for x ticks
// 0 = conservative (only confirm kills)
// 1 = random-focus (Randomly focus on different creeps)
// 2 = random-spread (Randomly attack multiple creeps)
// 3 = max damage (Deal the most damage)
// All strategies include confirming kills
// = Attacking creeps that cannot heal more than the damage that is being done

// ##### Creep defense #####
// The defense manager takes control of defenders to centrally control them
// It tries to keep defenders close to hostiles that are potentially vulnurable
// Creeps should always attack if possible
// If multiple targets are available for one creep follow the towers if possible
