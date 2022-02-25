import { Manager } from "./manager";
import { GenerateBodyFromPattern, bodySortingValues, rolePatterns } from "../utils/CreepBodyGenerator";
import { packPosition, unpackPosition } from "../utils/RoomPositionPacker";
import { roomTotalStoredEnergy } from "utils/RoomCalc";
import * as C from "../config/constants";
import * as roles from "../creeps/roles";
import { RunEvery } from "utils/RunEvery";
import { generateName } from "utils/CreepNames";
import { pushGCL } from "config/config";
import {
    HaulerMemory,
    MinerMemory,
    QuickFillerMemory,
    RemoteHaulerMemory,
    RemoteMinerMemory,
    ReserverMemory
} from "creeps/roles";
import { CreepRole } from "creeps/runner";
import { Building, Storage } from "buildings";
import { isOwnedRoom } from "../utils/RoomCalc";
import { RoomData } from "data/room/room";

declare global {
    interface OwnedRoomMemory {
        spawnAttempts?: number;
        spawnQueue: SpawnData[];
        waitingCreep?: SpawnData;
        energySupply?: number;
    }
}

interface SpawnData {
    pattern?: string;
    role?: CreepRole;
    energy?: number;
    memory?: CreepMemory;
    body?: BodyPartConstant[];
    index?: number;
    inside?: boolean;
    name?: string;
}
type CreepNeedCheckFunction = (
    room: OwnedRoom,
    creeps: Creep[],
    counts: _.Dictionary<number>,
    roles: _.Dictionary<Creep[]>
) => SpawnData | null;

// Spawning system
// check waitingCreep and try to spawn it
// check needs (array of functions returning SpawnData)
// try to spawn needs that trigger - if failed put it in waitingCreep
// take spawn data from spawnQueue if no needs

export class SpawnManager implements Manager {
    minSpeed = 0.2;
    maxSpeed = 1;
    public run(speed: number) {
        RunEvery(
            () => {
                for (const i in Game.rooms) {
                    const room: Room = Game.rooms[i];
                    if (isOwnedRoom(room)) {
                        const spawns: StructureSpawn[] = room.find(FIND_MY_SPAWNS, {
                            filter: (s) => s.spawning === null || s.spawning === undefined
                        });
                        if (spawns.length > 0) {
                            if (this.checkWaiting(room, spawns)) {
                                continue;
                            }
                            if (this.checkQueue(room, spawns)) {
                                continue;
                            }
                            this.checkNeeds(room, spawns);
                        }
                    }
                }
            },
            "spawnmanagerrun",
            3 / speed
        );
    }
    public checkWaiting(room: OwnedRoom, spawns: StructureSpawn[]): boolean {
        if (room.memory.waitingCreep === undefined) {
            return false;
        }
        const result = this.spawnCreep(room, spawns, room.memory.waitingCreep);
        if (result) {
            room.memory.waitingCreep = undefined;
        } else {
            room.memory.spawnAttempts = room.memory.spawnAttempts || 0;
            room.memory.spawnAttempts += 1;
            if (room.memory.spawnAttempts >= 10) {
                room.memory.waitingCreep = undefined;
                room.memory.spawnAttempts = 0;
            }
        }
        return true;
    }
    public checkNeeds(room: OwnedRoom, spawns: StructureSpawn[]): boolean {
        const creeps = _.filter(Game.creeps, (c) => c.memory.home === room.name);
        const creepCounts = _.countBy(creeps, (c) => c.memory.role);
        const creepRoles = _.groupBy(creeps, (c) => c.memory.role);

        for (const role of Object.keys(roles)) {
            creepCounts[role] = creepCounts[role] || 0;
            creepRoles[role] = creepRoles[role] || [];
        }

        let need: SpawnData | undefined;
        for (const needCheck of needChecks) {
            const res: SpawnData | null = needCheck(room, creeps, creepCounts, creepRoles);
            if (res !== null) {
                need = res;
                break;
            }
        }
        if (need !== undefined) {
            const result = this.spawnCreep(room, spawns, need);
            if (!result) {
                room.memory.waitingCreep = need;
            }
            return true;
        }
        return false;
    }
    public checkQueue(room: OwnedRoom, spawns: StructureSpawn[]): boolean {
        room.memory.spawnQueue = room.memory.spawnQueue || [];
        const spawnData: SpawnData | undefined = room.memory.spawnQueue.shift();
        if (spawnData !== undefined) {
            const result = this.spawnCreep(room, spawns, spawnData);
            if (!result) {
                room.memory.spawnQueue.unshift(spawnData);
                return false;
            }
            return true;
        }
        return false;
    }
    public spawnCreep(room: OwnedRoom, spawns: StructureSpawn[], spawnData: SpawnData): boolean {
        let body: BodyPartConstant[] | undefined;
        if (spawnData.body === undefined) {
            if (spawnData.pattern !== undefined && spawnData.energy !== undefined) {
                body = GenerateBodyFromPattern(spawnData.pattern, spawnData.energy).sort(
                    (a, b) => bodySortingValues[a] - bodySortingValues[b]
                );
            } else {
                console.log("SpawnData error no body " + spawnData.role);
            }
        } else {
            body = spawnData.body;
        }
        let memory: CreepMemory | undefined;
        if (spawnData.memory === undefined) {
            if (spawnData.role !== undefined) {
                memory = { role: spawnData.role as CreepRole, home: room.name };
            } else {
                console.log("SpawnData error no memory " + spawnData.role);
            }
        } else {
            memory = Object.assign({}, spawnData.memory);
        }

        const name: string = spawnData.name || generateName();

        if (body === undefined || memory === undefined || name === undefined) {
            return false;
        } else {
            let spawner: number = 0;
            if (spawnData.index !== undefined) {
                if (room.memory.genLayout !== undefined && room.memory.genBuildings !== undefined) {
                    spawner = _.findIndex(spawns, (s) =>
                        s.pos.isEqualTo(unpackPosition(room.memory.genBuildings!.spawns[spawnData.index!].pos))
                    );
                    if (spawner === -1) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            let directions: DirectionConstant[] | undefined;

            if (Memory.rooms[room.name].genBuildings !== undefined && Memory.rooms[room.name].genLayout !== undefined) {
                const index =
                    spawnData.index ||
                    _.findIndex(room.memory.genBuildings!.spawns, (i) =>
                        unpackPosition(i.pos).isEqualTo(spawns[spawner].pos)
                    );

                const { rotx: crx, roty: cry } = room.memory.genLayout!.prefabs[0];
                const { rotx: qrx, roty: qry } = room.memory.genLayout!.prefabs[2];

                directions = spawnDirection(spawnData.inside ?? false, index, crx, cry, qrx, qry);
            }
            return (
                spawns[spawner].spawnCreep(body, name, {
                    memory,
                    directions,
                    energyStructures: GetEnergyStructures(room)
                }) === OK
            );
        }
    }
}

// tslint:disable:no-shadowed-variable
const needChecks: CreepNeedCheckFunction[] = [
    // Check zero creeps => foots
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (creeps.length === 0 && !room.memory.unclaim) {
            const potentialEnergy = roomTotalStoredEnergy(room);
            if (potentialEnergy >= 1000) {
                return {
                    role: "filler",
                    pattern: rolePatterns.filler,
                    energy: Math.max(300, room.energyAvailable)
                };
            } else {
                return {
                    role: "foot",
                    pattern: rolePatterns.foot,
                    energy: Math.max(300, room.energyAvailable)
                };
            }
        }
        return null;
    },
    // Check minimum operation (filler + miner)
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (counts.miner === 0 && !room.memory.unclaim) {
            return {
                role: "miner",
                pattern: rolePatterns.miner,
                energy: Math.max(room.energyAvailable, 300),
                memory: {
                    role: "miner",
                    home: room.name,
                    source: 0
                }
            };
        }
        if (counts.filler === 0 && !room.memory.unclaim) {
            return {
                role: "filler",
                pattern: rolePatterns.filler,
                energy: Math.max(room.energyAvailable, 300)
            };
        }
        return null;
    },
    // Check miners and haulers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        const haulerTarget =
            room.controller!.level === 1 || room.controller!.level > 7 ? 0 : room.controller!.level > 6 ? 1 : 2;

        if (room.memory.genLayout === undefined || room.memory.unclaim) {
            return null;
        }

        if (counts.miner < room.memory.genLayout.sources.length && haulerTarget === 0) {
            if (counts.miner === 0) {
                return {
                    role: "miner",
                    pattern: rolePatterns.miner,
                    energy: GetEnergyCapacity(room),
                    memory: {
                        role: "miner",
                        home: room.name,
                        source: 0
                    }
                };
            }
            if (
                room.memory.genLayout!.sources.length === 2 &&
                counts.miner === 1 &&
                roles.miner[0] !== undefined &&
                (roles.miner[0].memory as MinerMemory).source !== undefined
            ) {
                return {
                    role: "miner",
                    pattern: rolePatterns.miner,
                    energy: GetEnergyCapacity(room),
                    memory: {
                        role: "miner",
                        home: room.name,
                        source: (roles.miner[0].memory as MinerMemory).source === 0 ? 1 : 0
                    }
                };
            }
            for (let i = 0; i < room.memory.genLayout!.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles.miner) {
                    if ((miner.memory as MinerMemory).source === i) {
                        hasMiner = true;
                    }
                }
                if (hasMiner === false) {
                    return {
                        role: "miner",
                        pattern: rolePatterns.miner,
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "miner",
                            home: room.name,
                            source: i
                        }
                    };
                }
            }
        }

        if (counts.miner < room.memory.genLayout.sources.length || counts.hauler < haulerTarget) {
            for (let i = 0; i < room.memory.genLayout.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles.miner) {
                    if ((miner.memory as MinerMemory).source === i) {
                        hasMiner = true;
                        break;
                    }
                }
                if (!hasMiner) {
                    return {
                        role: "miner",
                        pattern: rolePatterns.miner,
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "miner",
                            home: room.name,
                            source: i
                        }
                    };
                } else if (haulerTarget + i > 1) {
                    let hasHauler = false;
                    for (const hauler of roles.hauler) {
                        if ((hauler.memory as HaulerMemory).source === i) {
                            hasHauler = true;
                            break;
                        }
                    }
                    if (!hasHauler) {
                        return {
                            role: "hauler",
                            pattern: rolePatterns.hauler,
                            energy: GetEnergyCapacity(room),
                            memory: {
                                role: "hauler",
                                home: room.name,
                                source: i
                            }
                        };
                    }
                }
            }
        }
        return null;
    },
    // Check fillers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (counts.filler < 2 && !room.memory.unclaim) {
            return {
                role: "filler",
                pattern: rolePatterns.filler,
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check scouts
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            counts.scout < 1 &&
            room.controller &&
            room.controller.level < 8 &&
            room.memory.scoutTargets !== undefined &&
            room.memory.scoutTargets!.length > 0 &&
            !room.memory.unclaim
        ) {
            return {
                role: "scout",
                pattern: rolePatterns.scout,
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check QuickFillers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            room.memory.genLayout === undefined ||
            room.memory.genBuildings === undefined ||
            room.controller === undefined ||
            room.controller.level < 5 ||
            room.memory.unclaim
        ) {
            return null;
        }

        let shouldSpawn = true;
        if (room.controller.level < 7) {
            const qfContainers = [Building(room.memory.genBuildings.containers[0])].concat(
                Building(room.memory.genBuildings.containers[1])
            );
            for (const container of qfContainers) {
                if (
                    container === null ||
                    (container instanceof StructureContainer &&
                        container.store.getUsedCapacity(RESOURCE_ENERGY) < container.store.getCapacity() * 0.25)
                ) {
                    shouldSpawn = false;
                    break;
                }
            }
        }

        if (counts.quickFiller < 4 && shouldSpawn) {
            // [dx,dy,spawnIndex]
            const offsets: number[][] = [
                [-1, -1, 1],
                [1, -1, 1],
                [-1, 1, 2],
                [1, 1, 2]
            ];
            const center = new RoomPosition(
                room.memory.genLayout.prefabs[2].x,
                room.memory.genLayout.prefabs[2].y,
                room.name
            );

            for (const position of offsets) {
                const pos = new RoomPosition(center.x + position[0], center.y + position[1], room.name);
                let has = false;
                const spawn = Building(room.memory.genBuildings.spawns[position[2]]);
                for (const creep of roles.quickFiller) {
                    if (creep.pos.isEqualTo(pos) || (creep.memory as QuickFillerMemory).pos === packPosition(pos)) {
                        has = true;
                        break;
                    }
                    if (spawn !== null) {
                        if (creep.pos.isEqualTo(spawn.pos)) {
                            has = true;
                            break;
                        }
                    }
                }
                if (!has) {
                    if (spawn !== null) {
                        return {
                            role: "quickFiller",
                            pattern: rolePatterns.quickFiller,
                            energy: GetEnergyCapacity(room),
                            index: position[2],
                            inside: true
                        };
                    }
                    return {
                        role: "quickFiller",
                        pattern: rolePatterns.quickFiller + "m",
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "quickFiller",
                            home: room.name,
                            pos: packPosition(pos)
                        } as QuickFillerMemory
                    };
                }
            }
        }
        return null;
    },
    // Check minimal workers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            counts.worker === 0 &&
            (room.memory.placedCS.length > 0 ||
                (room.memory.repair !== undefined && Object.keys(room.memory.repair).length > 0)) &&
            !room.memory.unclaim
        ) {
            return {
                role: "worker",
                pattern: rolePatterns.worker,
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check upgrader
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.controller === undefined || room.memory.unclaim) {
            return null;
        }
        if (
            counts.upgrader < 1 &&
            (room.controller.level < 8 ||
                (pushGCL &&
                    room.memory.resources !== undefined &&
                    room.memory.resources.total[RESOURCE_ENERGY] > C.PUSH_GCL_ENERGY_NEEDED) ||
                room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.2)
        ) {
            return {
                role: "upgrader",
                pattern: room.controller.level < 8 ? rolePatterns.upgrader : "[mwcwmw]5",
                energy: Math.min(GetEnergyCapacity(room), 3000)
            };
        }
        return null;
    },
    // Check remote support
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteSupportRooms.length > 0 && !room.memory.unclaim) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt = _.filter(Game.creeps, (c: Creep) => c.memory.role === "foot" && c.memory.home === r)
                    .length;

                if (fAmt < 3 && Game.rooms[r] !== undefined) {
                    return {
                        role: "foot",
                        pattern: rolePatterns.foot,
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "foot",
                            home: r
                        }
                    };
                }
            }
        }
        return null;
    },
    // Check protector
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            room.memory.remoteData === undefined ||
            Object.keys(room.memory.remoteData.data).length === 0 ||
            room.memory.unclaim
        ) {
            return null;
        }
        if (counts.protector < 1) {
            return {
                role: "protector",
                pattern: rolePatterns.protector,
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check remote support protector
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteSupportRooms.length > 0 && !room.memory.unclaim) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt = _.filter(Game.creeps, (c: Creep) => c.memory.role === "protector" && c.memory.home === r)
                    .length;

                if (fAmt < 1 && Game.rooms[r] !== undefined) {
                    return {
                        role: "protector",
                        pattern: rolePatterns.protector,
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "protector",
                            home: r
                        }
                    };
                }
            }
        }
        return null;
    },
    // Check remote miners and haulers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteData === undefined || room.memory.unclaim) {
            return null;
        }

        let minerTarget = 0;
        let haulerTarget = 0;
        const haulerPerRoom: { [key: string]: number } = {};
        for (const remote in room.memory.remoteData.data) {
            minerTarget += room.memory.remoteData.data[remote].sources.length;
            haulerPerRoom[remote] = 0;
            for (const source of room.memory.remoteData.data[remote].sources) {
                haulerTarget += source.haulers.amountNeeded;
                haulerPerRoom[remote] += source.haulers.amountNeeded;
            }
        }

        if (counts.remoteMiner < minerTarget) {
            const splitByRoom = _.groupBy(roles.remoteMiner, (c) => (c.memory as RemoteMinerMemory).room);
            for (const remote in room.memory.remoteData.data) {
                if (
                    splitByRoom[remote] === undefined ||
                    splitByRoom[remote].length < room.memory.remoteData.data[remote].sources.length
                ) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let hasMiner = false;
                        if (splitByRoom[remote] !== undefined) {
                            for (const creep of splitByRoom[remote]) {
                                if ((creep.memory as RemoteMinerMemory).source === i) {
                                    hasMiner = true;
                                    break;
                                }
                            }
                        }
                        if (!hasMiner) {
                            return {
                                role: "remoteMiner",
                                pattern: rolePatterns.remoteMiner,
                                energy: GetEnergyCapacity(room),
                                memory: {
                                    role: "remoteMiner",
                                    home: room.name,
                                    room: remote,
                                    source: i,
                                    container: room.energyCapacityAvailable >= 700 ? true : false
                                }
                            };
                        }
                    }
                }
            }
        }
        if (counts.remoteHauler < haulerTarget) {
            const splitByRoom = _.groupBy(roles.remoteHauler, (c) => (c.memory as RemoteHaulerMemory).room);
            for (const remote in room.memory.remoteData.data) {
                if (splitByRoom[remote] === undefined || splitByRoom[remote].length < haulerPerRoom[remote]) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let haulerAmount = 0;
                        if (splitByRoom[remote] !== undefined) {
                            for (const creep of splitByRoom[remote]) {
                                if ((creep.memory as RemoteHaulerMemory).source === i) {
                                    haulerAmount += 1;
                                }
                            }
                        }
                        if (haulerAmount < room.memory.remoteData.data[remote].sources[i].haulers.amountNeeded) {
                            return {
                                role: "remoteHauler",
                                pattern:
                                    rolePatterns.remoteHauler +
                                    room.memory.remoteData.data[remote].sources[i].haulers.size.toString(),
                                energy: GetEnergyCapacity(room),
                                memory: {
                                    role: "remoteHauler",
                                    home: room.name,
                                    room: remote,
                                    source: i
                                }
                            };
                        }
                    }
                }
            }
        }
        return null;
    },
    // Check reservers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            room.memory.remoteData === undefined ||
            Object.keys(room.memory.remoteData.data).length === 0 ||
            room.memory.unclaim
        ) {
            return null;
        }

        if (counts.reserver < Object.keys(room.memory.remoteData.data).length && GetEnergyCapacity(room) >= 650) {
            const splitByRoom = _.groupBy(roles.reserver, (c) => (c.memory as ReserverMemory).room);

            for (const remote of room.memory.remotes) {
                if (Game.rooms[remote] === undefined) {
                    continue;
                }
                const reservation = Game.rooms[remote].controller?.reservation;
                if (
                    (splitByRoom[remote] === undefined || splitByRoom[remote].length === 0) &&
                    (reservation === undefined ||
                        reservation.ticksToEnd < 3000 ||
                        reservation.username !== Object.values(Game.spawns)[0].owner.username)
                ) {
                    return {
                        role: "reserver",
                        pattern: rolePatterns.reserver,
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "reserver",
                            home: room.name,
                            room: remote
                        }
                    };
                }
            }
        }
        return null;
    },
    // Check manager
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            (room.controller !== undefined && room.controller.level < 5) ||
            room.memory.genLayout === undefined ||
            room.memory.genBuildings === undefined ||
            room.memory.genBuildings.spawns[0].id === undefined ||
            !(Game.getObjectById(room.memory.genBuildings.spawns[0].id) instanceof StructureSpawn)
        ) {
            return null;
        }
        if (counts.manager === 1) {
            const manager = roles.manager[0];
            if (manager !== undefined && manager.ticksToLive && manager.ticksToLive <= CREEP_SPAWN_TIME * 16) {
                return {
                    role: "manager",
                    pattern: rolePatterns.manager,
                    energy: GetEnergyCapacity(room),
                    index: 0,
                    inside: true
                };
            }
        } else if (counts.manager < 1) {
            return {
                role: "manager",
                pattern: rolePatterns.manager,
                energy: GetEnergyCapacity(room),
                index: 0,
                inside: true
            };
        }
        return null;
    },
    // Check workers
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            room.memory.buildEnergy === undefined ||
            room.memory.repairEnergy === undefined ||
            room.memory.unclaim ||
            room.memory.resources === undefined
        ) {
            return null;
        }

        let energySupply = 0;
        for (const creep of roles.worker) {
            for (const part of creep.body) {
                if (part.type === "work") {
                    energySupply += (creep.ticksToLive ?? 1500) * 0.4;
                }
            }
        }

        room.memory.energySupply = energySupply;

        const workerBoost = room.controller.level <= 3 && room.memory.resources.total.energy >= 5000 ? 6000 : 0;

        const energyDemand = room.memory.buildEnergy + room.memory.repairEnergy + workerBoost - energySupply;

        const workerLimit = Math.min(
            Storage(room) === null ? Infinity : 1 + Math.ceil(room.memory.resources.total.energy / 10000),
            Math.ceil(2 / (Math.min(room.energyCapacityAvailable, 3000) * 0.0002))
        );

        if (energyDemand > 0 && counts.worker < workerLimit) {
            return {
                role: "worker",
                pattern: rolePatterns.worker,
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check mineral mining crew
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            (room.controller && room.controller.level < 6) ||
            (room.memory.resources !== undefined &&
                room.memory.resources.total[RESOURCE_ENERGY] < C.MINERAL_MINING_ENERGY_NEEDED) ||
            room.memory.genBuildings === undefined ||
            room.memory.unclaim
        ) {
            return null;
        }

        const basicMineralData = RoomData(room.name).basicRoomData.get()?.mineral; // TODO: fix this
        if (basicMineralData === null || basicMineralData === undefined) {
            return null;
        }
        const mineral: Mineral | null = Game.getObjectById(basicMineralData.id);
        if (mineral === null || mineral.mineralAmount === 0) {
            return null;
        }

        if (counts.mineralMiner === 0 || counts.mineralHauler === 0) {
            const extractor = room.find(FIND_MY_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_EXTRACTOR
            })[0];
            if (room.memory.genBuildings.containers[room.memory.genBuildings.containers.length - 1].id !== undefined) {
                const container = Game.getObjectById(
                    room.memory.genBuildings.containers[room.memory.genBuildings.containers.length - 1].id!
                );
                if (
                    extractor !== undefined &&
                    container instanceof Structure &&
                    room.memory.resources !== undefined &&
                    room.memory.resources?.total[mineral.mineralType] < C.ROOM_MINERAL_EXPORT_LIMIT * 1.5
                ) {
                    if (counts.mineralMiner === 0) {
                        return {
                            role: "mineralMiner",
                            pattern: rolePatterns.mineralMiner,
                            energy: GetEnergyCapacity(room)
                        };
                    }
                    if (counts.mineralHauler === 0) {
                        return {
                            role: "mineralHauler",
                            pattern: rolePatterns.mineralHauler,
                            energy: GetEnergyCapacity(room)
                        };
                    }
                }
            }
        }
        return null;
    },
    // Check upgraders
    (room: OwnedRoom, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.controller === undefined || room.memory.unclaim || room.memory.resources === undefined) {
            return null;
        }

        const limit = Math.max(
            Math.ceil(1 + (room.memory.resources.total[RESOURCE_ENERGY] - C.PUSH_GCL_ENERGY_NEEDED) / 100000),
            1
        );

        if (
            counts.upgrader < limit &&
            (room.controller.level < 8 ||
                (pushGCL &&
                    room.memory.resources !== undefined &&
                    room.memory.resources.total[RESOURCE_ENERGY] > C.PUSH_GCL_ENERGY_NEEDED) ||
                room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.2)
        ) {
            return {
                role: "upgrader",
                pattern: room.controller.level < 8 ? rolePatterns.upgrader : "[mwcwmw]5",
                energy: Math.min(GetEnergyCapacity(room), 3000)
            };
        }
        return null;
    }
];
// tslint:enable:no-shadowed-variable

function spawnDirection(
    inside: boolean,
    index: number,
    crx: number = 0,
    cry: number = 0,
    qrx: number = 0,
    qry: number = 0
): DirectionConstant[] | undefined {
    const { rx, ry } = index === 0 ? { rx: crx, ry: cry } : { rx: qrx, ry: qry };
    if (inside) {
        return spawnDirectionInside(index, rx, ry);
    } else {
        return spawnDirectionOutside(index, rx, ry);
    }
}

function spawnDirectionInside(index: number, rx: number, ry: number): DirectionConstant[] | undefined {
    const s = (rx === 1 ? "1" : "0") + (ry === 1 ? "1" : "0");
    if (index === 0) {
        switch (s) {
            case "11":
                return [TOP_RIGHT];
            case "01":
                return [TOP_LEFT];
            case "10":
                return [BOTTOM_RIGHT];
            case "00":
                return [BOTTOM_LEFT];
            default:
                console.log("spawnDirectionInside(): invalid rotation");
                return undefined;
        }
    }
    if (index === 1) {
        switch (s) {
            case "11":
                return [BOTTOM_LEFT, BOTTOM_RIGHT];
            case "01":
                return [BOTTOM_LEFT, BOTTOM_RIGHT];
            case "10":
                return [TOP_LEFT, TOP_RIGHT];
            case "00":
                return [TOP_LEFT, TOP_RIGHT];
            default:
                console.log("spawnDirectionInside(): invalid rotation");
                return undefined;
        }
    }
    if (index === 2) {
        switch (s) {
            case "11":
                return [TOP_LEFT, TOP_RIGHT];
            case "01":
                return [TOP_LEFT, TOP_RIGHT];
            case "10":
                return [BOTTOM_LEFT, BOTTOM_RIGHT];
            case "00":
                return [BOTTOM_LEFT, BOTTOM_RIGHT];
            default:
                console.log("spawnDirectionInside(): invalid rotation");
                return undefined;
        }
    }
    console.log("spawnDirectionInside(): invalid index " + index);
    return undefined;
}

function spawnDirectionOutside(index: number, rx: number, ry: number): DirectionConstant[] | undefined {
    const s = (rx === 1 ? "1" : "0") + (ry === 1 ? "1" : "0");
    if (index === 0) {
        switch (s) {
            case "11":
                return [TOP_LEFT, LEFT, BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            case "01":
                return [TOP_RIGHT, RIGHT, BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            case "10":
                return [BOTTOM_LEFT, LEFT, TOP_LEFT, TOP, TOP_RIGHT];
            case "00":
                return [BOTTOM_RIGHT, RIGHT, TOP_LEFT, TOP, TOP_RIGHT];
            default:
                console.log("spawnDirectionOutside(): invalid rotation");
                return undefined;
        }
    }
    if (index === 1) {
        switch (s) {
            case "11":
                return [TOP_LEFT, TOP, TOP_RIGHT];
            case "01":
                return [TOP_LEFT, TOP, TOP_RIGHT];
            case "10":
                return [BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            case "00":
                return [BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            default:
                console.log("spawnDirectionOutside(): invalid rotation");
                return undefined;
        }
    }
    if (index === 2) {
        switch (s) {
            case "11":
                return [BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            case "01":
                return [BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT];
            case "10":
                return [TOP_LEFT, TOP, TOP_RIGHT];
            case "00":
                return [TOP_LEFT, TOP, TOP_RIGHT];
            default:
                console.log("spawnDirectionOutside(): invalid rotation");
                return undefined;
        }
    }
    console.log("spawnDirectionOutside(): invalid index " + index);
    return undefined;
}

function GetEnergyStructures(room: Room): (StructureSpawn | StructureExtension)[] | undefined {
    if (Memory.rooms[room.name].genBuildings === undefined) {
        return undefined;
    }
    const energyStructures = [];
    for (const building of Memory.rooms[room.name].genBuildings!.spawns) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureSpawn) {
                energyStructures.push(object);
            }
        }
    }
    for (const building of Memory.rooms[room.name].genBuildings!.extensions) {
        if (building.id !== undefined) {
            const object = Game.getObjectById(building.id);
            if (object instanceof StructureExtension) {
                energyStructures.push(object);
            }
        }
    }
    if (energyStructures.length === 0) {
        return undefined;
    }
    return energyStructures;
}

function GetEnergyCapacity(room: Room): number {
    if (room.controller!.level >= 7) {
        return room.energyCapacityAvailable - 200;
    }
    return room.energyCapacityAvailable;
}
