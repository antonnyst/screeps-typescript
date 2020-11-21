import { rolePatterns } from "../../utils/CreepBodyGenerator";
import { SourceData, RemoteSourceData } from "../../dataInterfaces/sourceData";
import { unpackPosition } from "../../utils/RoomPositionPacker";
import { offsetPositionByDirection } from "../../utils/RoomPositionHelpers";
import * as C from "../../config/constants";
import { roomTotalStoredEnergy } from "../../utils/RoomCalc";
import { SpawnData } from "../../dataInterfaces/spawnData";

export function SpawnHandler(room: Room): void {
    if (Game.time % 2 === 0 && room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        const spawns = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_SPAWN && s.spawning === null
        });

        if (spawns.length > 0) {
            updateSpawnQueue(room);
        }
    }
}

function updateSpawnQueue(room: Room): void {
    if (room.memory.spawnQueue === undefined) {
        room.memory.spawnQueue = [];
    }

    if (room.memory.spawnQueue.length > 0) {
        if (
            room.memory.spawnQueue[0].energy !== undefined &&
            room.memory.spawnQueue[0].energy! > room.energyCapacityAvailable
        ) {
            room.memory.spawnQueue.shift();
        }
    }

    const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);

    if (creeps.length === 0) {
        const potentialEnergy = roomTotalStoredEnergy(room);

        if (potentialEnergy >= 700) {
            room.memory.spawnQueue = [];
            const role = "filler";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: Math.max(300, room.energyAvailable)
            });
        } else {
            room.memory.spawnQueue = [];
            const role = "foot";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: Math.max(300, room.energyAvailable)
            });
        }
    } else {
        const roleCount: { [roleName: string]: number } = {};
        const roleNeeds: { [roleName: string]: number } = {};
        const roleDelta: { [roleName: string]: number } = {};

        const roles: string[] = Object.keys(roleCountFunctions);

        for (const i in roles) {
            const r = roles[i];
            roleCount[r] = roleCountFunctions[r](room, creeps);
            roleNeeds[r] = roleNeedsFunctions[r](room);
            roleDelta[r] = roleCount[r] - roleNeeds[r];
            roleCalcFunctions[r](room, roleDelta[r]);
        }

        if (room.memory.remoteSupportRooms.length > 0) {
            for (const r of room.memory.remoteSupportRooms) {
                const fAmt =
                    _.filter(Game.creeps, (c: Creep) => c.memory.role === "foot" && c.memory.home === r).length +
                    _.filter(
                        room.memory.spawnQueue,
                        (sd: SpawnData) => sd.role === "foot" && sd.memory && sd.memory.home === r
                    ).length;

                if (fAmt < 2) {
                    const role = "foot";
                    room.memory.spawnQueue.push({
                        role,
                        pattern: rolePatterns[role],
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role,
                            home: r
                        }
                    });
                }
            }
        }
    }
}

const roleCountFunctions: { [role: string]: RoleCountFunction } = {
    foot: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "foot").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "foot").length
        );
    },
    upgrader: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "upgrader").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "upgrader").length
        );
    },
    miner: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(
                creeps,
                (c: Creep) => c.memory.role === "miner" && (c.ticksToLive === undefined || c.ticksToLive > 50)
            ).length + _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "miner").length
        );
    },
    builder: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "builder").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "builder").length
        );
    },
    filler: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "filler").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "filler").length
        );
    },
    hauler: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "hauler").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "hauler").length
        );
    },
    remoteMiner: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(
                creeps,
                (c: Creep) => c.memory.role === "remoteMiner" && (c.ticksToLive === undefined || c.ticksToLive > 50)
            ).length + _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "remoteMiner").length
        );
    },
    remoteHauler: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "remoteHauler").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "remoteHauler").length
        );
    },
    reserver: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "reserver").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "reserver").length
        );
    },
    peacekeeper: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "peacekeeper").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "peacekeeper").length
        );
    },
    scout: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "scout").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "scout").length
        );
    },
    mineralMiner: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "mineralMiner").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "mineralMiner").length
        );
    },
    mineralHauler: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "mineralHauler").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "mineralHauler").length
        );
    },
    labrador: (room: Room, creeps: Creep[]): number => {
        return (
            _.filter(creeps, (c: Creep) => c.memory.role === "labrador").length +
            _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "labrador").length
        );
    }
};

const roleNeedsFunctions: { [role: string]: RoleNeedFunction } = {
    foot: (room: Room): number => {
        if (room.controller && room.controller.level === 1) {
            return 2;
        } else {
            return 0;
        }
    },
    upgrader: (room: Room): number => {
        if (room.controller !== undefined && room.controller.level >= 7) {
            return 1;
        }

        if (room.storage === undefined) {
            return 3;
        } else {
            return (
                1 +
                Math.floor(
                    (room.memory.resources !== undefined ? room.memory.resources.total[RESOURCE_ENERGY] : 0) / 100000
                )
            );
        }
    },
    miner: (room: Room): number => {
        return room.memory.layout.sources.length;
    },
    builder: (room: Room): number => {
        if (
            room.memory.constructionSites === undefined ||
            room.memory.repairTargets === undefined ||
            room.controller === undefined
        ) {
            return 0;
        }
        const repNum = Math.max(
            Object.keys(room.memory.constructionSites).length,
            Object.keys(room.memory.repairTargets).length
        );
        const num = Math.ceil(repNum / (10 / (10 - room.controller.level)));

        return Math.min(num, 12 - room.controller.level);
    },
    filler: (room: Room): number => {
        return 2;
    },
    hauler: (room: Room): number => {
        const cPos = unpackPosition(room.memory.layout.controllerStore);
        const container: StructureContainer = _.filter(
            cPos.lookFor(LOOK_STRUCTURES),
            (s: Structure) => s.structureType === STRUCTURE_CONTAINER
        )[0] as StructureContainer;

        if (room.storage !== undefined || container !== undefined) {
            if (room.controller !== undefined && room.controller.level > 5) {
                if (room.controller.level > 6) {
                    return 0;
                } else {
                    return 1;
                }
            }
            return 2;
        } else {
            return 0;
        }
    },
    remoteMiner: (room: Room): number => {
        let i: number = 0;

        for (const r of room.memory.remotes) {
            if (
                Memory.rooms[r] !== undefined &&
                Memory.rooms[r].remoteLayout !== undefined &&
                Memory.rooms[r].remoteLayout.sources !== undefined
            ) {
                i += Memory.rooms[r].remoteLayout.sources.length;
            }
        }

        return i;
    },
    remoteHauler: (room: Room): number => {
        let i: number = 0;

        for (const r of room.memory.remotes) {
            if (
                Memory.rooms[r] !== undefined &&
                Memory.rooms[r].remoteLayout !== undefined &&
                Memory.rooms[r].remoteLayout.sources !== undefined
            ) {
                i += Memory.rooms[r].remoteLayout.sources.length;
            }
        }

        return i;
    },
    reserver: (room: Room): number => {
        return room.memory.remotes.length;
    },
    peacekeeper: (room: Room): number => {
        return room.memory.remotes.length > 0 ? 1 : 0;
    },
    scout: (room: Room): number => {
        if (room.controller?.level === 8) {
            return 0;
        }
        return Game.time % 10000 < 5000 ? 1 : 0;
    },
    mineralMiner: (room: Room): number => {
        if (room.controller && room.controller.level < 6) {
            return 0;
        }
        if (
            room.memory.resources !== undefined &&
            room.memory.resources.total[RESOURCE_ENERGY] < C.MINERAL_MINING_ENERGY_NEEDED
        ) {
            return 0;
        }
        const mineral = room.find(FIND_MINERALS)[0];
        if (mineral.mineralAmount > 0) {
            return 1;
        } else {
            return 0;
        }
    },
    mineralHauler: (room: Room): number => {
        if (room.controller && room.controller.level < 6) {
            return 0;
        }
        if (
            room.memory.resources !== undefined &&
            room.memory.resources.total[RESOURCE_ENERGY] < C.MINERAL_MINING_ENERGY_NEEDED
        ) {
            return 0;
        }
        const mineral = room.find(FIND_MINERALS)[0];
        if (mineral.mineralAmount > 0) {
            return 1;
        } else {
            return 0;
        }
    },
    labrador: (room: Room): number => {
        if (room.controller !== undefined && room.controller.level >= 6) {
            return 1;
        } else {
            return 0;
        }
    }
};

const roleCalcFunctions: { [role: string]: RoleCalcFunction } = {
    foot: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "foot").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "foot";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    },
    upgrader: (room: Room, delta: number): void => {
        if (delta < 0) {
            const role = "upgrader";
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "upgrader").length;
            if (sqAmt > 0) {
                return;
            }
            if (room.controller && room.controller.level === 8) {
                room.memory.spawnQueue.push({
                    role,
                    pattern: "[mwcwmw]5",
                    energy: room.energyCapacityAvailable
                });
            } else if (
                room.controller &&
                room.controller.level === 7 &&
                room.memory.resources &&
                room.memory.resources.total[RESOURCE_ENERGY] >= C.FULL_UPGRADER_ENERGY_NEEDED
            ) {
                room.memory.spawnQueue.push({
                    role,
                    pattern: "w40m5c5",
                    energy: room.energyCapacityAvailable
                });
            } else {
                room.memory.spawnQueue.push({
                    role,
                    pattern: rolePatterns[role],
                    energy: Math.min(room.energyCapacityAvailable, 3000)
                });
            }
        }
    },
    miner: (room: Room, delta: number): void => {
        // const mCount:number = _.filter(creeps, (c)=>(c.memory.role === "miner")).length;

        if (delta < 0) {
            for (const s in room.memory.layout.sources) {
                const source: SourceData = room.memory.layout.sources[s];
                // console.log(s);
                const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
                const minerCount: number =
                    _.filter(
                        creeps,
                        (c: Creep) =>
                            c.memory.role === "miner" &&
                            c.memory.roleData !== undefined &&
                            c.memory.roleData.targetId === s &&
                            (c.ticksToLive === undefined || c.ticksToLive > 25 + source.dist * 3)
                    ).length +
                    _.filter(
                        room.memory.spawnQueue,
                        (sd: SpawnData) =>
                            sd.role === "miner" &&
                            sd.memory !== null &&
                            sd.memory !== undefined &&
                            sd.memory.roleData !== undefined &&
                            sd.memory.roleData.targetId === s
                    ).length;
                if (minerCount === 0) {
                    const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "foot").length;
                    if (sqAmt > 0) {
                        const role = "miner";
                        room.memory.spawnQueue.push({
                            role,
                            pattern: rolePatterns[role],
                            energy: room.energyCapacityAvailable,
                            memory: {
                                role,
                                home: room.name,
                                roleData: {
                                    targetId: s
                                }
                            }
                        });
                    } else {
                        const famt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "filler").length;
                        const role = "miner";
                        room.memory.spawnQueue.unshift({
                            role,
                            pattern: rolePatterns[role],
                            energy: famt === 0 ? Math.max(300, room.energyAvailable) : room.energyCapacityAvailable,
                            memory: {
                                role,
                                home: room.name,
                                roleData: {
                                    targetId: s
                                }
                            }
                        });
                    }
                }
            }
        }
    },
    builder: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "builder").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "builder";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    },
    filler: (room: Room, delta: number): void => {
        const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
        const fillerCount: number = _.filter(creeps, (c: Creep) => c.memory.role === "filler").length;

        if (fillerCount === 0 && creeps.length > 0) {
            // const sqAmt = room.memory.spawnQueue, (c)=>(c.role === "filler")).length;
            if (
                room.memory.spawnQueue[0] !== undefined &&
                room.memory.spawnQueue[0].role === "filler" &&
                room.memory.spawnQueue[0].energy! <= Math.max(room.energyAvailable, 300)
            ) {
                return;
            }
            const role = "filler";
            room.memory.spawnQueue.unshift({
                role,
                pattern: rolePatterns[role],
                energy: Math.max(room.energyAvailable, 300)
            });
        } else if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "filler").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "filler";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    },
    hauler: (room: Room, delta: number): void => {
        if (delta < 0) {
            for (const s in room.memory.layout.sources) {
                const sourceData: SourceData = room.memory.layout.sources[s];

                const link = _.filter(
                    offsetPositionByDirection(
                        offsetPositionByDirection(unpackPosition(sourceData.pos), sourceData.container),
                        sourceData.link
                    ).lookFor(LOOK_STRUCTURES),
                    (st: Structure) => st.structureType === STRUCTURE_LINK
                )[0];

                const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
                const haulerCount: number =
                    _.filter(
                        creeps,
                        (c: Creep) =>
                            c.memory.role === "hauler" &&
                            c.memory.roleData !== undefined &&
                            c.memory.roleData.targetId === s
                    ).length +
                    _.filter(
                        room.memory.spawnQueue,
                        (sd: SpawnData) =>
                            sd.role === "hauler" &&
                            sd.memory !== null &&
                            sd.memory !== undefined &&
                            sd.memory.roleData !== undefined &&
                            sd.memory.roleData.targetId === s
                    ).length;
                if (link === undefined && haulerCount === 0) {
                    const tdist = sourceData.dist * 2;

                    const capacityNeeded = (SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME) * tdist;
                    const carryNeeded = capacityNeeded / 50;
                    const patternValue = Math.ceil(carryNeeded / 2) + 1;
                    room.memory.spawnQueue.push({
                        role: "hauler",
                        pattern: "[mcc]" + patternValue,
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role: "hauler",
                            home: room.name,
                            roleData: {
                                targetId: s
                            }
                        }
                    });
                }
            }
        }
    },
    remoteMiner: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "remoteMiner").length;
            if (sqAmt > 0) {
                return;
            }
            const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
            for (const remote of room.memory.remotes) {
                for (const source in Memory.rooms[remote].remoteLayout.sources) {
                    const s: RemoteSourceData = Memory.rooms[remote].remoteLayout.sources[source];
                    const remoteMinerCount: number =
                        _.filter(
                            creeps,
                            (c: Creep) =>
                                c.memory.role === "remoteMiner" &&
                                c.memory.roleData !== undefined &&
                                c.memory.roleData.target === remote &&
                                c.memory.roleData.targetId === source &&
                                (c.ticksToLive === undefined || c.ticksToLive > 34 + s.dist * 2)
                        ).length +
                        _.filter(
                            room.memory.spawnQueue,
                            (sd: SpawnData) =>
                                sd.role === "remoteMiner" &&
                                sd.memory !== undefined &&
                                sd.memory.roleData !== undefined &&
                                sd.memory.roleData.target === remote &&
                                sd.memory.roleData.targetId === source
                        ).length;
                    if (remoteMinerCount === 0) {
                        const role = "remoteMiner";
                        room.memory.spawnQueue.push({
                            role,
                            pattern: rolePatterns[role],
                            energy: room.energyCapacityAvailable,
                            memory: {
                                role,
                                home: room.name,
                                roleData: {
                                    targetId: source,
                                    target: remote
                                }
                            }
                        });
                    }
                }
            }
        }
    },
    remoteHauler: (room: Room, delta: number): void => {
        if (delta < 0 || true) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "remoteHauler").length;
            if (sqAmt > 0) {
                return;
            }
            const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
            for (const remote of room.memory.remotes) {
                for (const source in Memory.rooms[remote].remoteLayout.sources) {
                    const sourceData: RemoteSourceData = Memory.rooms[remote].remoteLayout.sources[source];
                    const remoteHaulerCount: number =
                        _.filter(
                            creeps,
                            (c: Creep) =>
                                c.memory.role === "remoteHauler" &&
                                c.memory.roleData !== undefined &&
                                c.memory.roleData.target === remote &&
                                c.memory.roleData.targetId === source
                        ).length +
                        _.filter(
                            room.memory.spawnQueue,
                            (sd: SpawnData) =>
                                sd.role === "remoteHauler" &&
                                sd.memory !== undefined &&
                                sd.memory.roleData !== undefined &&
                                sd.memory.roleData.target === remote &&
                                sd.memory.roleData.targetId === source
                        ).length;
                    const tdist = sourceData.dist * 2;

                    const capacityNeeded = (SOURCE_ENERGY_CAPACITY / ENERGY_REGEN_TIME) * tdist;
                    const carryNeeded = capacityNeeded / 50;
                    const creepsNeeded = Math.ceil(carryNeeded / 33);
                    const patternValue = Math.ceil(carryNeeded / creepsNeeded / 2) + 1;

                    if (remoteHaulerCount < creepsNeeded) {
                        room.memory.spawnQueue.push({
                            role: "remoteHauler",
                            pattern: "[mcc]" + patternValue,
                            energy: room.energyCapacityAvailable,
                            memory: {
                                role: "remoteHauler",
                                home: room.name,
                                roleData: {
                                    targetId: source,
                                    target: remote
                                }
                            }
                        });
                    }
                }
            }
        }
    },
    reserver: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "reserver").length;
            if (sqAmt > 0) {
                return;
            }
            const creeps: Creep[] = _.filter(Game.creeps, (c: Creep) => c.memory.home === room.name);
            for (const remote of room.memory.remotes) {
                const reserverCount: number =
                    _.filter(
                        creeps,
                        (c: Creep) =>
                            c.memory.role === "reserver" &&
                            c.memory.roleData !== undefined &&
                            c.memory.roleData.target === remote
                    ).length +
                    _.filter(
                        room.memory.spawnQueue,
                        (sd: SpawnData) =>
                            sd.role === "remoteHauler" &&
                            sd.memory !== undefined &&
                            sd.memory.roleData !== undefined &&
                            sd.memory.roleData.target === remote
                    ).length;
                const reservation = Memory.rooms[remote].reservation;

                if (
                    reserverCount === 0 &&
                    (reservation === undefined ||
                        reservation.username !== "Awesomeadda" ||
                        reservation.ticksToEnd < 3000)
                ) {
                    const role = "reserver";
                    room.memory.spawnQueue.push({
                        role,
                        pattern: rolePatterns[role],
                        energy: room.energyCapacityAvailable,
                        memory: {
                            role,
                            home: room.name,
                            roleData: {
                                target: remote
                            }
                        }
                    });
                }
            }
        }
    },
    peacekeeper: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "peacekeeper").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "peacekeeper";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    },
    scout: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "scout").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "scout";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: 50
            });
        }
    },
    mineralMiner: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "mineralMiner").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "mineralMiner";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    },
    mineralHauler: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "mineralHauler").length;
            if (sqAmt > 0) {
                return;
            }

            const mineralData = room.memory.layout.mineral;

            const tdist = mineralData.dist * 2;

            const capacityNeeded = (40 / 6) * tdist;
            const carryNeeded = capacityNeeded / 50;
            const patternValue = Math.ceil(carryNeeded / 2) + 1;

            room.memory.spawnQueue.push({
                role: "mineralHauler",
                pattern: "[mcc]" + patternValue,
                energy: room.energyCapacityAvailable
            });
        }
    },
    labrador: (room: Room, delta: number): void => {
        if (delta < 0) {
            const sqAmt = _.filter(room.memory.spawnQueue, (sd: SpawnData) => sd.role === "labrador").length;
            if (sqAmt > 0) {
                return;
            }
            const role = "labrador";
            room.memory.spawnQueue.push({
                role,
                pattern: rolePatterns[role],
                energy: room.energyCapacityAvailable
            });
        }
    }
};
