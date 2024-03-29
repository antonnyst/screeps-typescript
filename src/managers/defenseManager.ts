import { CalculateTowerDamage, CalculateTowerHeal } from "utils/towers";
import { Manager } from "./manager";
import { isOwnedRoom } from "../utils/RoomCalc";
import { packPosition } from "utils/RoomPositionPacker";

declare global {
  interface OwnedRoomMemory {
    defenseData?: DefenseData;
  }
}

interface DefenseData {
  hostiles: HostileCreepData[];
  defenders: DefenderCreepData[];
  strategy: number;
  until: number;
}
interface HostileCreepData {
  id: Id<Creep>;
  pos: number;
  updated: number;
  potentialDamage: number;
  potentialHeal: number;
}
interface DefenderCreepData {
  id: Id<Creep>;
  pos: number;
  updated: number;
  potentialDamage: number;
  potentialHeal: number;
}
interface TowerDirective {
  targets: { id: Id<Creep>; towers?: number[] }[];
}
type StrategyFunction = (room: string, data: DefenseData, towers: StructureTower[]) => TowerDirective;
interface Strategy {
  weight: number;
  run: StrategyFunction;
}

const STRATEGY_TIME = 50;
const STRATEGY_TIME_VARIATION = 25;

const STRATEGIES: Strategy[] = [
  {
    // conservative (only confirm kills)
    weight: 70,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    run: (room: string, data: DefenseData, _towers: StructureTower[]) => {
      let highestDiff = 0;
      let highestId: Id<Creep> | null = null;
      for (const hostile of data.hostiles) {
        if (hostile.potentialDamage > hostile.potentialHeal) {
          const diff = hostile.potentialDamage - hostile.potentialHeal;
          if (diff > highestDiff) {
            highestDiff = diff;
            highestId = hostile.id;
          }
        }
      }
      if (highestId !== null) {
        return { targets: [{ id: highestId }] };
      }

      for (const defender of data.defenders) {
        const obj = Game.getObjectById(defender.id);
        if (obj !== null && obj.hits < obj.hitsMax) {
          return { targets: [{ id: defender.id }] };
        }
      }

      const friendlies = Game.rooms[room].find(FIND_MY_CREEPS);
      for (const friendly of friendlies) {
        if (friendly.hits < friendly.hitsMax) {
          return { targets: [{ id: friendly.id }] };
        }
      }

      return { targets: [] };
    }
  },
  {
    // random-focus (Randomly focus on different creeps)
    weight: 10,
    run: (room: string, data: DefenseData, towers: StructureTower[]) => {
      const confirm = STRATEGIES[0].run(room, data, towers);
      if (confirm.targets.length > 0) {
        return confirm;
      }

      if (data.hostiles.length > 0) {
        const target: { id: Id<Creep> } = { id: _.sample(data.hostiles).id };
        return { targets: [target] };
      }
      return { targets: [] };
    }
  },
  {
    // random-spread (Randomly attack multiple creeps)
    weight: 10,
    run: (room: string, data: DefenseData, towers: StructureTower[]) => {
      const confirm = STRATEGIES[0].run(room, data, towers);
      if (confirm.targets.length > 0) {
        return confirm;
      }

      const amount: number = Math.floor(Math.random() * towers.length + 1);
      const targets: { id: Id<Creep> }[] = _.sample(data.hostiles, amount).map(c => {
        return { id: c.id };
      });

      return { targets: [...targets] };
    }
  },
  {
    // max damage (Deal the most damage)
    weight: 10,
    run: (room: string, data: DefenseData, towers: StructureTower[]) => {
      const confirm = STRATEGIES[0].run(room, data, towers);
      if (confirm.targets.length > 0) {
        return confirm;
      }

      return { targets: [] };
    }
  }
];

// //// DEFENSE MANAGER //////
// The DefendeManager should calculate damage and healing potentials and control towers and creep defenders

// # STEPS #
// Gather data (DefenseData interface) potential heal, potential damage etc
// Run tower defense
// Run creep defense

// ##### Tower defense #####
// Run selected strategy for x ticks then change

// # STRATEGIES #
// Strategies are randomly chosen and last for x ticks
// 0 = conservative (only confirm kills + keep alive friendlies)
// 1 = random-focus (Randomly focus on different creeps)
// 2 = random-spread (Randomly attack multiple creeps)
// 3 = max damage (Deal the most damage)
// All strategies include conservative
// = Attacking creeps that cannot heal more than the damage that is being done

// ##### Creep defense #####
// The defense manager takes control of defenders to centrally control them
// It tries to keep defenders close to hostiles that are potentially vulnurable
// Creeps should always attack if possible
// If multiple targets are available for one creep follow the towers if possible

export class DefenseManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(_speed: number): void {
    for (const room of Object.values(Game.rooms)) {
      if (isOwnedRoom(room) && room.memory.genBuildings !== undefined) {
        GatherData(room);

        if (room.memory.defenseData !== undefined && Game.time > room.memory.defenseData.until) {
          // Select new strategy;
          const cdf: number[] = [];
          for (let i = 0; i < STRATEGIES.length; i++) {
            cdf[i] = STRATEGIES[i].weight;
            if (i > 0) {
              cdf[i] += cdf[i - 1];
            }
          }

          const selected: number = Math.floor(Math.random() * (cdf[cdf.length - 1] + 1));

          let strategy: number | undefined;
          for (let i = cdf.length - 1; i >= 0; i--) {
            if (selected <= cdf[i]) {
              strategy = i;
            }
          }

          if (strategy !== undefined) {
            room.memory.defenseData.strategy = strategy;

            room.memory.defenseData.until =
              Game.time +
              Math.floor(Math.random() * (STRATEGY_TIME_VARIATION * 2 + 1) + STRATEGY_TIME - STRATEGY_TIME_VARIATION);

            /* console.log(
                            room +
                                ": Selected strategy " +
                                Memory.rooms[room].defenseData!.strategy +
                                " for " +
                                (Memory.rooms[room].defenseData!.until - Game.time) +
                                " ticks!"
                        );*/
          }
        }

        const towerDirective: TowerDirective = RunTowers(room);

        RunCreeps(room.name, towerDirective);
      }
    }
  }
}

function GatherData(room: OwnedRoom): void {
  if (room.memory.defenseData === undefined) {
    room.memory.defenseData = {
      hostiles: [],
      defenders: [],
      strategy: 0,
      until: 0
    };
  }

  room.memory.defenseData.hostiles = [];
  room.memory.defenseData.defenders = [];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const towers: StructureTower[] = room.memory
    .genBuildings!.towers.map(t => {
      if (t.id === undefined) {
        return null;
      }
      const obj = Game.getObjectById(t.id);
      if (obj instanceof StructureTower) {
        return obj;
      } else {
        return null;
      }
    })
    .filter(x => x !== null) as StructureTower[];

  const hostiles: Creep[] = room.find(FIND_HOSTILE_CREEPS);
  const defenders: Creep[] = room.find(FIND_MY_CREEPS, {
    filter: c => c.memory.home === room.name && c.memory.role === "defender"
  });

  for (const hostile of hostiles) {
    const damage: number = [0]
      .concat(
        towers.map(t => CalculateTowerDamage(t, hostile.pos)),
        defenders.map(d => {
          const range: number = d.pos.getRangeTo(hostile);
          let sum = 0;
          if (range <= 1) {
            sum += ATTACK_POWER * d.getActiveBodyparts(ATTACK);
          }
          if (range <= 3) {
            sum += RANGED_ATTACK_POWER * d.getActiveBodyparts(RANGED_ATTACK);
          }
          return sum;
        })
      )
      .reduce((a, b) => a + b);
    const heal: number = hostiles
      .map(h => {
        const range: number = h.pos.getRangeTo(hostile);
        if (range <= 1) {
          return HEAL_POWER * h.getActiveBodyparts(HEAL);
        }
        if (range > 3) {
          return 0;
        }
        return RANGED_HEAL_POWER * h.getActiveBodyparts(HEAL);
      })
      .reduce((a, b) => a + b);

    room.memory.defenseData.hostiles.push({
      id: hostile.id,
      pos: packPosition(hostile.pos),
      updated: Game.time,
      potentialDamage: damage,
      potentialHeal: heal
    });
  }

  for (const defender of defenders) {
    const heal: number = [0].concat(towers.map(t => CalculateTowerHeal(t, defender.pos))).reduce((a, b) => a + b);
    const damage: number = hostiles
      .map(h => {
        const range: number = h.pos.getRangeTo(defender);
        let sum = 0;
        if (range <= 1) {
          sum += ATTACK_POWER * h.getActiveBodyparts(ATTACK);
        }
        if (range <= 3) {
          sum += RANGED_ATTACK_POWER * h.getActiveBodyparts(RANGED_ATTACK);
        }
        return sum;
      })
      .reduce((a, b) => a + b);

    room.memory.defenseData.defenders.push({
      id: defender.id,
      pos: packPosition(defender.pos),
      updated: Game.time,
      potentialDamage: damage,
      potentialHeal: heal
    });
  }
}

function RunTowers(room: OwnedRoom): TowerDirective {
  if (room.memory.defenseData === undefined || room.memory.genBuildings === undefined) {
    return {
      targets: []
    };
  }

  const towers: StructureTower[] = room.memory.genBuildings.towers
    .map(t => {
      if (t.id === undefined) {
        return null;
      }
      const obj = Game.getObjectById(t.id);
      if (obj instanceof StructureTower) {
        return obj;
      } else {
        return null;
      }
    })
    .filter(x => x !== null) as StructureTower[];

  const strategy: number = room.memory.defenseData.strategy;

  const towerDirective: TowerDirective = STRATEGIES[strategy].run(room.name, room.memory.defenseData, towers);

  if (towerDirective.targets.length > 0) {
    const towersWithTargets: number[] = [];
    for (const targets of towerDirective.targets) {
      if (targets.towers !== undefined) {
        for (const tower of targets.towers) {
          towersWithTargets.push(tower);
        }
      }
    }

    const towersWithoutTargets: number[] = [];
    for (let i = 0; i < towers.length; i++) {
      if (!_.some(towersWithTargets, i)) {
        towersWithoutTargets.push(i);
      }
    }

    while (towersWithoutTargets.length > 0) {
      const tower: number | undefined = towersWithoutTargets.pop();
      if (tower === undefined) {
        continue;
      }
      let lowestCount = Infinity;
      let lowestIndex = 0;

      for (let i = 0; i < towerDirective.targets.length; i++) {
        const count = towerDirective.targets[i].towers?.length ?? 0;
        if (count < lowestCount) {
          lowestCount = count;
          lowestIndex = i;
        }
      }
      if (towerDirective.targets[lowestIndex].towers === undefined) {
        towerDirective.targets[lowestIndex].towers = [tower];
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        towerDirective.targets[lowestIndex].towers!.push(tower);
      }
    }

    for (const target of towerDirective.targets) {
      const obj = Game.getObjectById(target.id);
      if (obj !== null && target.towers !== undefined) {
        for (const towerIndex of target.towers) {
          towers[towerIndex][obj.my ? "heal" : "attack"](obj);
        }
      }
    }
  }

  return towerDirective;
}

/* eslint-disable @typescript-eslint/no-empty-function */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RunCreeps(room: string, towers: TowerDirective): void {}
/* eslint-enable @typescript-eslint/no-empty-function */
