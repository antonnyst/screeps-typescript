import { Manager } from "./manager";
import { GenerateBodyFromPattern, bodySortingValues, rolePatterns } from "../utils/CreepBodyGenerator";
import { packPosition, unpackPosition } from "../utils/RoomPositionPacker";
import { roomTotalStoredEnergy } from "utils/RoomCalc";
import * as C from "../config/constants";
import * as roles from "../creeps/roles";
import { RunEvery } from "utils/RunEvery";
import { generateName } from "utils/CreepNames";
import { bucketTarget, pushGCL } from "config/config";
import { offsetPositionByDirection } from "utils/RoomPositionHelpers";
import { HaulerMemory, MinerMemory, RemoteHaulerMemory, RemoteMinerMemory, ReserverMemory } from "creeps/roles";
import { CreepRole } from "creeps/runner";

declare global {
    interface RoomMemory {
        spawnQueue: SpawnData[];
        waitingCreep?: SpawnData;
    }
}

interface SpawnData {
    pattern?: string;
    role?: string;
    energy?: number;
    memory?: CreepMemory;
    body?: BodyPartConstant[];
    index?: number;
    inside?: boolean;
    name?: string;
}
type CreepNeedCheckFunction = (
    room: Room,
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
                    if (room.memory.roomLevel === 2) {
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
    public checkWaiting(room: Room, spawns: StructureSpawn[]): boolean {
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
    public checkNeeds(room: Room, spawns: StructureSpawn[]): boolean {
        const creeps = _.filter(Game.creeps, (c) => c.memory.home === room.name);
        const creepCounts = _.countBy(creeps, (c) => c.memory.role);
        const creepRoles = _.groupBy(creeps, (c) => c.memory.role);

        for (const role of Object.keys(roles)) {
            creepCounts[role] = creepCounts[role] || 0;
            creepRoles[role] = creepRoles[role] || [];
        }

        let need: SpawnData | undefined;
        for (let i = 0; i < needChecks.length; i++) {
            const res: SpawnData | null = needChecks[i](room, creeps, creepCounts, creepRoles);
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
    public checkQueue(room: Room, spawns: StructureSpawn[]): boolean {
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
    public spawnCreep(room: Room, spawns: StructureSpawn[], spawnData: SpawnData): boolean {
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

        let name: string = spawnData.name || generateName();

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

            let directions: DirectionConstant[] | undefined = undefined;

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

const needChecks: CreepNeedCheckFunction[] = [
    //Check zero creeps => foots
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (creeps.length === 0) {
            const potentialEnergy = roomTotalStoredEnergy(room);
            if (potentialEnergy >= 1000) {
                return {
                    role: "filler",
                    pattern: rolePatterns["filler"],
                    energy: Math.max(300, room.energyAvailable)
                };
            } else {
                return {
                    role: "foot",
                    pattern: rolePatterns["foot"],
                    energy: Math.max(300, room.energyAvailable)
                };
            }
        }
        return null;
    },
    //Check minimum operation (filler + miner)
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (counts["miner"] === 0) {
            return {
                role: "miner",
                pattern: rolePatterns["miner"],
                energy: Math.max(room.energyAvailable, 300),
                memory: {
                    role: "miner",
                    home: room.name,
                    source: 0
                }
            };
        }
        if (counts["filler"] === 0) {
            return {
                role: "filler",
                pattern: rolePatterns["filler"],
                energy: Math.max(room.energyAvailable, 300)
            };
        }
        return null;
    },
    //Check fillers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (counts["filler"] < 2) {
            return {
                role: "filler",
                pattern: rolePatterns["filler"],
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    //Check miners and haulers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        const haulerTarget =
            room.controller!.level === 1 || room.controller!.level > 6 ? 0 : room.controller!.level > 5 ? 1 : 2;

        if (counts["miner"] < room.memory.genLayout!.sources.length && haulerTarget === 0) {
            if (counts["miner"] === 0) {
                return {
                    role: "miner",
                    pattern: rolePatterns["miner"],
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
                counts["miner"] === 1 &&
                roles["miner"][0] !== undefined &&
                (roles["miner"][0].memory as MinerMemory).source !== undefined
            ) {
                return {
                    role: "miner",
                    pattern: rolePatterns["miner"],
                    energy: GetEnergyCapacity(room),
                    memory: {
                        role: "miner",
                        home: room.name,
                        source: (roles["miner"][0].memory as MinerMemory).source === 0 ? 1 : 0
                    }
                };
            }
            for (let i = 0; i < room.memory.genLayout!.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles["miner"]) {
                    if ((miner.memory as MinerMemory).source === i) {
                        hasMiner = true;
                    }
                }
                if (hasMiner === false) {
                    return {
                        role: "miner",
                        pattern: rolePatterns["miner"],
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

        if (counts["miner"] < room.memory.genLayout!.sources.length || counts["hauler"] < haulerTarget) {
            for (let i = 0; i < room.memory.genLayout!.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles["miner"]) {
                    if ((miner.memory as MinerMemory).source === i) {
                        hasMiner = true;
                        break;
                    }
                }
                if (!hasMiner) {
                    return {
                        role: "miner",
                        pattern: rolePatterns["miner"],
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "miner",
                            home: room.name,
                            source: i
                        }
                    };
                } else if (haulerTarget + i > 1) {
                    let hasHauler = false;
                    for (const hauler of roles["hauler"]) {
                        if ((hauler.memory as HaulerMemory).source === i) {
                            hasHauler = true;
                            break;
                        }
                    }
                    if (!hasHauler) {
                        return {
                            role: "hauler",
                            pattern: rolePatterns["hauler"],
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
    //Check scouts
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            (Game.time % 10000 < 5000 || room.controller?.level === 2) &&
            counts["scout"] < 1 &&
            room.controller &&
            room.controller.level < 8
        ) {
            return {
                role: "scout",
                pattern: rolePatterns["scout"],
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    // Check QuickFillers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.genLayout === undefined || room.memory.genBuildings === undefined) {
            return null;
        }
        if (room.controller!.level < 7) {
            return null;
        }

        if (counts["quickFiller"] < 4) {
            if (room.controller!.level === 7) {
                if (Memory.rooms[room.name].genBuildings!.spawns[1].id !== undefined) {
                    const spawner = Game.getObjectById(Memory.rooms[room.name].genBuildings!.spawns[1].id!);
                    if (spawner !== null && spawner instanceof StructureSpawn) {
                        let count = 0;
                        for (const creep of roles["quickFiller"]) {
                            if (creep.pos.isNearTo(spawner.pos)) {
                                count++;
                            }
                        }
                        if (count < 2) {
                            return {
                                role: "quickFiller",
                                pattern: rolePatterns["quickFiller"],
                                energy: GetEnergyCapacity(room),
                                index: 1,
                                inside: true
                            };
                        }
                    }
                }
                let count = 0;

                const spawnDirections = spawnDirectionInside(
                    2,
                    Memory.rooms[room.name].genLayout!.prefabs[2].rotx,
                    Memory.rooms[room.name].genLayout!.prefabs[2].roty
                )!;

                for (const spawnDirection of spawnDirections) {
                    const pos = offsetPositionByDirection(
                        unpackPosition(Memory.rooms[room.name].genBuildings!.spawns[2].pos),
                        spawnDirection
                    );
                    let has = false;
                    for (const creep of roles["quickFiller"]) {
                        if (
                            creep.pos.isEqualTo(pos) ||
                            (creep.memory.targetPos !== undefined &&
                                unpackPosition(creep.memory.targetPos).isEqualTo(pos))
                        ) {
                            has = true;
                            break;
                        }
                    }
                    if (!has) {
                        return {
                            role: "quickFiller",
                            pattern: rolePatterns["quickFiller"] + "m",
                            energy: GetEnergyCapacity(room),
                            inside: false,
                            memory: {
                                role: "quickFiller",
                                home: room.name,
                                pos: packPosition(pos)
                            }
                        };
                    }
                }
            } else if (room.controller!.level === 8) {
                if (Memory.rooms[room.name].genBuildings!.spawns[1].id !== undefined) {
                    const spawner = Game.getObjectById(Memory.rooms[room.name].genBuildings!.spawns[1].id!);
                    if (spawner !== null && spawner instanceof StructureSpawn) {
                        let count = 0;
                        for (const creep of roles["quickFiller"]) {
                            if (creep.pos.isNearTo(spawner.pos)) {
                                count++;
                            }
                        }

                        if (count < 2) {
                            return {
                                role: "quickFiller",
                                pattern: rolePatterns["quickFiller"],
                                energy: GetEnergyCapacity(room),
                                index: 1,
                                inside: true
                            };
                        }
                    }
                }
                if (Memory.rooms[room.name].genBuildings!.spawns[2].id !== undefined) {
                    const spawner = Game.getObjectById(Memory.rooms[room.name].genBuildings!.spawns[2].id!);
                    if (spawner !== null && spawner instanceof StructureSpawn) {
                        let count = 0;
                        for (const creep of roles["quickFiller"]) {
                            if (creep.pos.isNearTo(spawner.pos)) {
                                count++;
                            }
                        }

                        if (count < 2) {
                            return {
                                role: "quickFiller",
                                pattern: rolePatterns["quickFiller"],
                                energy: GetEnergyCapacity(room),
                                index: 2,
                                inside: true
                            };
                        }
                    }
                }
            }
        }
        return null;
    },
    //Check minimal builders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            counts["worker"] === 0 &&
            (room.memory.placedCS.length > 0 ||
                (room.memory.repair !== undefined && Object.keys(room.memory.repair).length > 0))
        ) {
            return {
                role: "worker",
                pattern: rolePatterns["builder"],
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    //Check emergency upgraders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (counts["upgrader"] < 1 && room.controller) {
            return {
                role: "upgrader",
                pattern: rolePatterns["upgrader"],
                energy: Math.min(GetEnergyCapacity(room), 3000)
            };
        }
        return null;
    },
    //Check remote support
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteSupportRooms.length > 0) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt = _.filter(Game.creeps, (c: Creep) => c.memory.role === "foot" && c.memory.home === r)
                    .length;

                if (fAmt < 3 && Game.rooms[r] !== undefined) {
                    return {
                        role: "foot",
                        pattern: rolePatterns["foot"],
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
    //Check peacekeeper
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remotes.length === 0 && Object.keys(room.memory.hostiles).length === 0) return null;

        if (counts["peacekeeper"] < 1) {
            return {
                role: "peacekeeper",
                pattern: rolePatterns["peacekeeper"],
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    //Check remote support peacekeeper
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteSupportRooms.length > 0) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt = _.filter(Game.creeps, (c: Creep) => c.memory.role === "protector" && c.memory.home === r)
                    .length;

                if (fAmt < 1 && Game.rooms[r] !== undefined) {
                    return {
                        role: "protector",
                        pattern: rolePatterns["peacekeeper"],
                        energy: GetEnergyCapacity(room)
                    };
                }
            }
        }
        return null;
    },
    //Check remote miners and haulers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteData === undefined) {
            return null;
        }

        let minerTarget = 0;
        let haulerTarget = 0;
        let haulerPerRoom: { [key: string]: number } = {};
        for (let remote in room.memory.remoteData.data) {
            minerTarget += room.memory.remoteData.data[remote].sources.length;
            haulerPerRoom[remote] = 0;
            for (const source of room.memory.remoteData.data[remote].sources) {
                haulerTarget += source.haulers.amountNeeded;
                haulerPerRoom[remote] += source.haulers.amountNeeded;
            }
        }

        if (counts["remoteMiner"] < minerTarget) {
            const splitByRoom = _.groupBy(roles["remoteMiner"], (c) => (c.memory as RemoteMinerMemory).room);
            for (let remote in room.memory.remoteData.data) {
                if (
                    splitByRoom[remote] === undefined ||
                    splitByRoom[remote].length < room.memory.remoteData.data[remote].sources.length
                ) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let hasMiner = false;
                        if (splitByRoom[remote] !== undefined) {
                            for (let j = 0; j < splitByRoom[remote].length; j++) {
                                if ((splitByRoom[remote][j].memory as RemoteMinerMemory).source === i) {
                                    hasMiner = true;
                                    break;
                                }
                            }
                        }
                        if (!hasMiner) {
                            return {
                                role: "remoteMiner",
                                pattern: rolePatterns["remoteMiner"],
                                energy: GetEnergyCapacity(room),
                                memory: {
                                    role: "remoteMiner",
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
        if (counts["remoteHauler"] < haulerTarget) {
            const splitByRoom = _.groupBy(roles["remoteHauler"], (c) => (c.memory as RemoteHaulerMemory).room);
            for (let remote in room.memory.remoteData.data) {
                if (splitByRoom[remote] === undefined || splitByRoom[remote].length < haulerPerRoom[remote]) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let haulerAmount = 0;
                        if (splitByRoom[remote] !== undefined) {
                            for (let j = 0; j < splitByRoom[remote].length; j++) {
                                if ((splitByRoom[remote][j].memory as RemoteHaulerMemory).source === i) {
                                    haulerAmount += 1;
                                }
                            }
                        }
                        if (haulerAmount < room.memory.remoteData.data[remote].sources[i].haulers.amountNeeded) {
                            return {
                                role: "remoteHauler",
                                pattern:
                                    rolePatterns["remoteHauler"] +
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
    //Check reservers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteData === undefined || Object.keys(room.memory.remoteData.data).length === 0) {
            return null;
        }

        if (counts["reserver"] < Object.keys(room.memory.remoteData.data).length && GetEnergyCapacity(room) >= 650) {
            const splitByRoom = _.groupBy(roles["reserver"], (c) => (c.memory as ReserverMemory).room);
            for (let i = 0; i < room.memory.remotes.length; i++) {
                if (Game.rooms[room.memory.remotes[i]] === undefined) {
                    continue;
                }
                const reservation = Game.rooms[room.memory.remotes[i]].controller?.reservation;
                if (
                    (splitByRoom[room.memory.remotes[i]] === undefined ||
                        splitByRoom[room.memory.remotes[i]].length === 0) &&
                    (reservation === undefined ||
                        reservation.ticksToEnd < 3000 ||
                        reservation.username !== Object.values(Game.spawns)[0].owner.username)
                ) {
                    return {
                        role: "reserver",
                        pattern: rolePatterns["reserver"],
                        energy: GetEnergyCapacity(room),
                        memory: {
                            role: "reserver",
                            home: room.name,
                            room: room.memory.remotes[i]
                        }
                    };
                }
            }
        }
        return null;
    },
    //Check manager
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            (room.controller !== undefined && room.controller.level < 5) ||
            room.memory.genLayout === undefined ||
            room.memory.genBuildings === undefined ||
            room.memory.genBuildings.spawns[0].id === undefined ||
            !(Game.getObjectById(room.memory.genBuildings.spawns[0].id) instanceof StructureSpawn)
        ) {
            return null;
        }
        if (counts["manager"] === 1) {
            const manager = roles["manager"][0];
            if (manager !== undefined && manager.ticksToLive && manager.ticksToLive <= CREEP_SPAWN_TIME * 16) {
                return {
                    role: "manager",
                    pattern: rolePatterns["manager"],
                    energy: GetEnergyCapacity(room),
                    index: 0,
                    inside: true
                };
            }
        } else if (counts["manager"] < 1) {
            return {
                role: "manager",
                pattern: rolePatterns["manager"],
                energy: GetEnergyCapacity(room),
                index: 0,
                inside: true
            };
        }
        return null;
    },
    //Check builders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        let builderTarget = Math.min(
            Math.max(
                Math.ceil(
                    (room.memory.placedCS.length + room.memory.plannedCS.length) /
                        (Math.min(room.energyCapacityAvailable, 3000) * 0.00167)
                ),
                Math.min(
                    Math.ceil(
                        Math.min(Object.keys(room.memory.repair).length + room.memory.rampartTargets || 0, 20) /
                            (Math.min(room.energyCapacityAvailable, 3000) * 0.0012)
                    ),
                    2
                )
            ),
            10
        );
        if (counts["worker"] < builderTarget) {
            return {
                role: "worker",
                pattern: rolePatterns["builder"],
                energy: GetEnergyCapacity(room)
            };
        }
        return null;
    },
    //Check upgraders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (!room.controller) {
            return null;
        }

        let upgraderTarget = 4;
        if (room.controller.level === 8) {
            if (room.controller.ticksToDowngrade < 100000) {
                upgraderTarget = 1;
            } else if (
                pushGCL &&
                Game.cpu.bucket > bucketTarget &&
                room.memory.resources &&
                room.memory.resources.total[RESOURCE_ENERGY] > C.ROOM_ENERGY_EXPORT_LIMIT * 0.95
            ) {
                upgraderTarget = 1;
            } else {
                upgraderTarget = 0;
            }
        } else if (room.controller.level === 7) {
            upgraderTarget = 1;
        } else if (room.storage) {
            upgraderTarget = 1 + Math.floor(room.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 100000);
        } else if (room.memory.remotes.length > 0) {
            upgraderTarget += room.memory.remotes.length;
        }

        if (counts["upgrader"] < upgraderTarget) {
            if (room.controller.level === 8) {
                return {
                    role: "upgrader",
                    pattern: "[mwcwmw]5",
                    energy: GetEnergyCapacity(room)
                };
            } else if (
                room.controller.level === 7 &&
                room.memory.resources &&
                room.memory.resources.total[RESOURCE_ENERGY] > C.FULL_UPGRADER_ENERGY_NEEDED
            ) {
                return {
                    role: "upgrader",
                    pattern: "m5c5w40",
                    energy: GetEnergyCapacity(room)
                };
            } else {
                return {
                    role: "upgrader",
                    pattern: rolePatterns["upgrader"],
                    energy: Math.min(GetEnergyCapacity(room), 3000)
                };
            }
        }
        return null;
    },
    //Check mineral mining crew
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            (room.controller && room.controller.level < 6) ||
            (room.memory.resources !== undefined &&
                room.memory.resources.total[RESOURCE_ENERGY] < C.MINERAL_MINING_ENERGY_NEEDED) ||
            room.memory.genBuildings === undefined
        ) {
            return null;
        }

        const mineralData = room.memory.genLayout!.mineral;
        const basicMineralData = room.memory.basicRoomData.mineral!;
        const mineral: Mineral | null = Game.getObjectById(basicMineralData.id);
        if (mineral === null || mineral.mineralAmount === 0) {
            return null;
        }

        if (counts["mineralMiner"] === 0 || counts["mineralHauler"] === 0) {
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
                    if (counts["mineralMiner"] === 0) {
                        return {
                            role: "mineralMiner",
                            pattern: rolePatterns["mineralMiner"],
                            energy: GetEnergyCapacity(room)
                        };
                    }
                    if (counts["mineralHauler"] === 0) {
                        return {
                            role: "mineralHauler",
                            pattern: rolePatterns["mineralHauler"],
                            energy: GetEnergyCapacity(room)
                        };
                    }
                }
            }
        }
        return null;
    }
];

function spawnDirection(
    inside: boolean,
    index: number,
    crx: number = 0,
    cry: number = 0,
    qrx: number = 0,
    qry: number = 0
): DirectionConstant[] | undefined {
    let { rx, ry } = index === 0 ? { rx: crx, ry: cry } : { rx: qrx, ry: qry };
    if (inside) {
        return spawnDirectionInside(index, rx, ry);
    } else {
        return spawnDirectionOutside(index, rx, ry);
    }
}

function spawnDirectionInside(index: number, rx: number, ry: number): DirectionConstant[] | undefined {
    const string = (rx === 1 ? "1" : "0") + (ry === 1 ? "1" : "0");
    if (index === 0) {
        switch (string) {
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
        switch (string) {
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
        switch (string) {
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
    console.log("spawnDirectionInside(): invalid index");
    return undefined;
}

function spawnDirectionOutside(index: number, rx: number, ry: number): DirectionConstant[] | undefined {
    const string = (rx === 1 ? "1" : "0") + (ry === 1 ? "1" : "0");
    if (index === 0) {
        switch (string) {
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
        switch (string) {
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
        switch (string) {
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
    console.log("spawnDirectionOutside(): invalid index");
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
