import { cancelMovementData, setMovementData } from "creeps/creep";
import { Squad } from "squad/squad";
import { unpackPosition } from "utils/RoomPositionPacker";

export interface PowerPairSquad extends Squad {
  type: "powerpair";
  id: Id<StructurePowerBank>;
}

function checkSquad(squad: Squad): squad is PowerPairSquad {
  return squad.type === "powerpair" && (squad as PowerPairSquad).id !== undefined;
}

export function powerpair(squad: Squad): void {
  if (!checkSquad(squad) || Memory.powerBanks === undefined) {
    return;
  }

  const powerBankData = Memory.powerBanks[squad.id];
  if (powerBankData === undefined) {
    return;
  }

  if (squad.creeps.length !== 2 || squad.creeps[0].current === undefined || squad.creeps[1].current === undefined) {
    return;
  }

  const attacker = Game.creeps[squad.creeps[0].current];
  const healer = Game.creeps[squad.creeps[1].current];

  if (attacker.spawning || healer.spawning) {
    // At least one creep is still spawning
    if (!attacker.spawning) {
      setMovementData(attacker, {
        pos: new RoomPosition(25, 25, attacker.room.name),
        range: 25
      });
    }
    if (!healer.spawning) {
      setMovementData(healer, {
        pos: new RoomPosition(25, 25, healer.room.name),
        range: 25
      });
    }
    return;
  }

  if (healer.pos.isNearTo(attacker)) {
    let healed = false;
    if (healer.hits < healer.hitsMax) {
      healer.heal(healer);
      healed = true;
    } else if (attacker.hits < attacker.hitsMax) {
      healer.heal(attacker);
      healed = true;
    }

    const powerBankPosition = unpackPosition(powerBankData.pos);
    if (powerBankPosition !== null) {
      if (attacker.pos.isNearTo(powerBankPosition)) {
        const powerBank = Game.getObjectById(squad.id);
        if (powerBank !== null) {
          attacker.attack(powerBank);
          if (!healed) {
            healer.heal(attacker);
          }
        }
      } else {
        // Move pair together
        setMovementData(attacker, {
          pos: powerBankPosition,
          range: 1
        });
        healer.move(healer.pos.getDirectionTo(attacker));
      }
    }
  } else {
    // Let healer catch up
    cancelMovementData(attacker);
    setMovementData(healer, {
      pos: attacker.pos,
      range: 1
    });
  }
}
