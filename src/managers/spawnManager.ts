import { Manager } from "./manager";
import { GenerateBodyFromPattern, bodySortingValues, rolePatterns } from "../utils/CreepBodyGenerator";
import { unpackPosition } from "../utils/RoomPositionPacker";
import { roomTotalStoredEnergy } from "utils/RoomCalc";
import * as C from "../config/constants";
import { roleList } from "roles/roleList";
import { RunEvery } from "utils/RunEvery";
import { generateName } from "utils/CreepNames";
import { bucketTarget, pushGCL } from "config/config";

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
                            if (this.checkNeeds(room, spawns)) {
                                continue;
                            }
                            this.checkQueue(room, spawns);
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

        for (const role of Object.keys(roleList)) {
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
    public checkQueue(room: Room, spawns: StructureSpawn[]): void {
        room.memory.spawnQueue = room.memory.spawnQueue || [];
        const spawnData: SpawnData | undefined = room.memory.spawnQueue.shift();
        if (spawnData !== undefined) {
            const result = this.spawnCreep(room, spawns, spawnData);
            if (!result) {
                room.memory.spawnQueue.unshift(spawnData);
            }
        }
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
                memory = { role: spawnData.role, home: room.name };
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
            return spawns[spawner].spawnCreep(body, name, { memory, directions }) === OK;
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
                    roleData: {
                        targetId: "0"
                    }
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
                energy: room.energyCapacityAvailable
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
                    energy: room.energyCapacityAvailable,
                    memory: {
                        role: "miner",
                        home: room.name,
                        roleData: {
                            targetId: "0"
                        }
                    }
                };
            }
            if (
                room.memory.genLayout!.sources.length === 2 &&
                counts["miner"] === 1 &&
                roles["miner"][0] !== undefined &&
                roles["miner"][0].memory.roleData?.targetId !== undefined
            ) {
                return {
                    role: "miner",
                    pattern: rolePatterns["miner"],
                    energy: room.energyCapacityAvailable,
                    memory: {
                        role: "miner",
                        home: room.name,
                        roleData: {
                            targetId: roles["miner"][0].memory.roleData.targetId === "0" ? "1" : "0"
                        }
                    }
                };
            }
            for (let i = 0; i < room.memory.genLayout!.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles["miner"]) {
                    if (miner.memory.roleData?.targetId === i.toString()) {
                        hasMiner = true;
                    }
                }
                if (hasMiner === false) {
                    return {
                        role: "miner",
                        pattern: rolePatterns["miner"],
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role: "miner",
                            home: room.name,
                            roleData: {
                                targetId: i.toString()
                            }
                        }
                    };
                }
            }
        }

        if (counts["miner"] < room.memory.genLayout!.sources.length || counts["hauler"] < haulerTarget) {
            for (let i = 0; i < room.memory.genLayout!.sources.length; i++) {
                let hasMiner = false;
                for (const miner of roles["miner"]) {
                    if (miner.memory.roleData?.targetId === i.toString()) {
                        hasMiner = true;
                        break;
                    }
                }
                if (!hasMiner) {
                    return {
                        role: "miner",
                        pattern: rolePatterns["miner"],
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role: "miner",
                            home: room.name,
                            roleData: {
                                targetId: i.toString()
                            }
                        }
                    };
                } else if (haulerTarget + i > 1) {
                    let hasHauler = false;
                    for (const hauler of roles["hauler"]) {
                        if (hauler.memory.roleData?.targetId === i.toString()) {
                            hasHauler = true;
                            break;
                        }
                    }
                    if (!hasHauler) {
                        return {
                            role: "hauler",
                            pattern: rolePatterns["hauler"],
                            energy: room.energyCapacityAvailable,
                            memory: {
                                role: "hauler",
                                home: room.name,
                                roleData: {
                                    targetId: i.toString()
                                }
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
                energy: room.energyCapacityAvailable
            };
        }
        return null;
    },
    //Check minimal builders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (
            counts["builder"] === 0 &&
            (room.memory.placedCS.length > 0 ||
                (room.memory.repair !== undefined && Object.keys(room.memory.repair).length > 0))
        ) {
            return {
                role: "builder",
                pattern: rolePatterns["builder"],
                energy: room.energyCapacityAvailable
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
                        energy: room.energyCapacityAvailable,
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
                energy: room.energyCapacityAvailable
            };
        }
        return null;
    },
    //Check remote support peacekeeper
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteSupportRooms.length > 0) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt = _.filter(Game.creeps, (c: Creep) => c.memory.role === "peacekeeper" && c.memory.home === r)
                    .length;

                if (fAmt < 1 && Game.rooms[r] !== undefined) {
                    return {
                        role: "peacekeeper",
                        pattern: rolePatterns["peacekeeper"],
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role: "peacekeeper",
                            home: r
                        }
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
            const splitByRoom = _.groupBy(roles["remoteMiner"], (c) => c.memory.roleData?.target);
            for (let remote in room.memory.remoteData.data) {
                if (
                    splitByRoom[remote] === undefined ||
                    splitByRoom[remote].length < room.memory.remoteData.data[remote].sources.length
                ) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let hasMiner = false;
                        if (splitByRoom[remote] !== undefined) {
                            for (let j = 0; j < splitByRoom[remote].length; j++) {
                                if (splitByRoom[remote][j].memory.roleData?.targetId === i.toString()) {
                                    hasMiner = true;
                                    break;
                                }
                            }
                        }
                        if (!hasMiner) {
                            return {
                                role: "remoteMiner",
                                pattern: rolePatterns["remoteMiner"],
                                energy: room.energyCapacityAvailable,
                                memory: {
                                    role: "remoteMiner",
                                    home: room.name,
                                    roleData: {
                                        targetId: i.toString(),
                                        target: remote
                                    }
                                }
                            };
                        }
                    }
                }
            }
        }
        if (counts["remoteHauler"] < haulerTarget) {
            const splitByRoom = _.groupBy(roles["remoteHauler"], (c) => c.memory.roleData?.target);
            for (let remote in room.memory.remoteData.data) {
                if (splitByRoom[remote] === undefined || splitByRoom[remote].length < haulerPerRoom[remote]) {
                    for (let i = 0; i < room.memory.remoteData.data[remote].sources.length; i++) {
                        let haulerAmount = 0;
                        if (splitByRoom[remote] !== undefined) {
                            for (let j = 0; j < splitByRoom[remote].length; j++) {
                                if (splitByRoom[remote][j].memory.roleData?.targetId === i.toString()) {
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
                                energy: room.energyCapacityAvailable,
                                memory: {
                                    role: "remoteHauler",
                                    home: room.name,
                                    roleData: {
                                        targetId: i.toString(),
                                        target: remote
                                    }
                                }
                            };
                        }
                    }
                }
            }
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
                    energy: room.energyCapacityAvailable
                };
            } else if (
                room.controller.level === 7 &&
                room.memory.resources &&
                room.memory.resources.total[RESOURCE_ENERGY] > C.FULL_UPGRADER_ENERGY_NEEDED
            ) {
                return {
                    role: "upgrader",
                    pattern: "w40m5c5",
                    energy: room.energyCapacityAvailable
                };
            } else {
                return {
                    role: "upgrader",
                    pattern: rolePatterns["upgrader"],
                    energy: Math.min(room.energyCapacityAvailable, 3000)
                };
            }
        }
        return null;
    },
    //Check reservers
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        if (room.memory.remoteData === undefined || Object.keys(room.memory.remoteData.data).length === 0) {
            return null;
        }

        if (
            counts["reserver"] < Object.keys(room.memory.remoteData.data).length &&
            room.energyCapacityAvailable >= 650
        ) {
            const splitByRoom = _.groupBy(roles["reserver"], (c) => c.memory.roleData?.target);
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
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role: "reserver",
                            home: room.name,
                            roleData: {
                                target: room.memory.remotes[i]
                            }
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
            room.controller &&
            room.controller.level >= 5 &&
            counts["manager"] < 1 &&
            room.memory.genLayout !== undefined &&
            room.memory.genBuildings !== undefined &&
            room.memory.genBuildings.spawns[0].id !== undefined &&
            Game.getObjectById(room.memory.genBuildings.spawns[0].id) instanceof StructureSpawn
        ) {
            return {
                role: "manager",
                pattern: rolePatterns["manager"],
                energy: room.energyCapacityAvailable,
                index: 0,
                inside: true
            };
        }
        return null;
    },
    //Check builders
    (room: Room, creeps: Creep[], counts: _.Dictionary<number>, roles: _.Dictionary<Creep[]>) => {
        let builderTarget = Math.max(
            Math.ceil(
                (room.memory.placedCS.length + room.memory.plannedCS.length) /
                    (Math.min(room.energyCapacityAvailable, 3000) * 0.00167)
            ),
            Math.min(
                Math.ceil(
                    Math.min(Object.keys(room.memory.repair).length, 20) /
                        (Math.min(room.energyCapacityAvailable, 3000) * 0.0012)
                ),
                2
            )
        );
        if (counts["builder"] < builderTarget) {
            return {
                role: "builder",
                pattern: rolePatterns["builder"],
                energy: room.energyCapacityAvailable
            };
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
                if (extractor !== undefined && container instanceof Structure) {
                    if (counts["mineralMiner"] === 0) {
                        return {
                            role: "mineralMiner",
                            pattern: rolePatterns["mineralMiner"],
                            energy: room.energyCapacityAvailable
                        };
                    }
                    if (counts["mineralHauler"] === 0) {
                        return {
                            role: "mineralHauler",
                            pattern: rolePatterns["mineralHauler"],
                            energy: room.energyCapacityAvailable
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
): DirectionConstant[] {
    let { rx, ry } = index === 0 ? { rx: crx, ry: cry } : { rx: qrx, ry: qry };
    if (inside) {
        return spawnDirectionInside(index, rx, ry);
    } else {
        return spawnDirectionOutside(index, rx, ry);
    }
}

function spawnDirectionInside(index: number, rx: number, ry: number): DirectionConstant[] {
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
                return [TOP];
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
                return [TOP];
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
                return [TOP];
        }
    }
    console.log("spawnDirectionInside(): invalid index");
    return [TOP];
}

function spawnDirectionOutside(index: number, rx: number, ry: number): DirectionConstant[] {
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
                return [TOP];
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
                return [TOP];
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
                return [TOP];
        }
    }
    console.log("spawnDirectionOutside(): invalid index");
    return [TOP];
}
