import { CreepRole } from "./creepRole";

import { ArmedDismantlerRole } from "./armedDismantler";
import { BlinkerRole } from "./blinkerRole";
import { BuilderRole } from "./builderRole";
import { ClaimerRole } from "./claimerRole";
import { DismantlerRole } from "./dismantlerRole";
import { DrainerRole } from "./drainerRole";
import { FillerRole } from "./fillerRole";
import { FootRole } from "./footRole";
import { GarbageRole } from "./garbageRole";
import { HaulerRole } from "./haulerRole";
import { HealerRole } from "./healerRole";
import { LabradorRole } from "./labradorRole";
import { ManagerRole } from "./managerRole";
import { MinerRole } from "./minerRole";
import { MineralHaulerRole } from "./mineralHauler";
import { MineralMinerRole } from "./mineralMiner";
import { PeacekeeperRole } from "./peacekeeperRole";
import { RaiderRole } from "./raiderRole";
import { RemoteHaulerRole } from "./remoteHaulerRole";
import { RemoteMinerRole } from "./remoteMinerRole";
import { ReserverRole } from "./reserverRole";
import { UpgraderRole } from "./upgraderRole";
import { ScoutRole } from "./scoutRole";

export const roleList: { [role: string]: CreepRole } = {
    armedDismantler: new ArmedDismantlerRole(),
    blinker: new BlinkerRole(),
    builder: new BuilderRole(),
    claimer: new ClaimerRole(),
    dismantler: new DismantlerRole(),
    drainer: new DrainerRole(),
    filler: new FillerRole(),
    foot: new FootRole(),
    garbage: new GarbageRole(),
    hauler: new HaulerRole(),
    healer: new HealerRole(),
    labrador: new LabradorRole(),
    manager: new ManagerRole(),
    miner: new MinerRole(),
    mineralHauler: new MineralHaulerRole(),
    mineralMiner: new MineralMinerRole(),
    peacekeeper: new PeacekeeperRole(),
    raider: new RaiderRole(),
    remoteHauler: new RemoteHaulerRole(),
    remoteMiner: new RemoteMinerRole(),
    reserver: new ReserverRole(),
    upgrader: new UpgraderRole(),
    scout: new ScoutRole()
};
