import { packPosition, unpackPosition } from "../utils/RoomPositionPacker";
import { getFromCache, saveToCache } from "../utils/Cache";

export interface CreepRoleInterface {
    creep: Creep | null;
    setCreep(creep: Creep): void;

    runLogic(): void;

    getEnergy(): void;
    smartMove(target: RoomPosition | { pos: RoomPosition }, range?: number): number;
    checkIdle(): void;
}

export abstract class CreepRole implements CreepRoleInterface {
    public creep: Creep | null = null;
    public setCreep(creep: Creep) {
        this.creep = creep;
    }

    public runLogic() {
        if (this.creep == null) {
            return;
        }

        if (this.creep.spawning) {
            return;
        }

        this.checkIdle();

        if (this.creep.memory.boost === undefined) {
            this.runRole();
        } else {
            this.runBoost();
        }
    }
    runRole() {
        if (this.creep == null) {
            return;
        }
    }

    runBoost() {
        if (this.creep == null) {
            return;
        }

        let resource: MineralBoostConstant | null = null;
        let boostCountNeeded: number = 0;

        for (const r of Object.keys(this.creep.memory.boost!)) {
            const tBoost: number = (this.creep.memory.boost! as any)[r] as number;
            const cBoost = _.filter(this.creep.body, (b: BodyPartDefinition) => b.boost === (r as MineralBoostConstant))
                .length;

            const delta = tBoost - cBoost;
            if (delta > 0) {
                resource = r as MineralBoostConstant;
                boostCountNeeded = delta;
                break;
            }
        }

        console.log(" " + resource);

        if (resource === null) {
            this.creep.memory.boost = undefined;
            return;
        }

        const lab: StructureLab = this.creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
            filter: (s) =>
                s.structureType === STRUCTURE_LAB &&
                s.mineralType === (resource as MineralBoostConstant) &&
                (s.store.getUsedCapacity(s.mineralType) as number) >= 30
        }) as StructureLab;

        if (lab === undefined) {
            return;
        }

        if (!this.creep.pos.isNearTo(lab.pos)) {
            this.smartMove(lab.pos);
        } else {
            lab.boostCreep(this.creep, boostCountNeeded);
        }
    }

    public getEnergy() {
        if (this.creep === null) {
            return;
        }

        if (this.creep.pos.roomName !== this.creep.memory.home) {
            this.setMovementData(
                unpackPosition(Memory.rooms[this.creep.memory.home].layout.baseCenter),
                20,
                false,
                false
            );
            return;
        }

        if (this.creep.memory.getEnergy === undefined) {
            this.creep.memory.getEnergy = {
                target: undefined
            };
        }

        let target: Structure | Resource | Tombstone | Ruin | Source | null = null;

        if (this.creep.memory.getEnergy.target !== undefined) {
            target = Game.getObjectById(this.creep.memory.getEnergy.target);
        }

        if (target === null) {
            target = this.getEnergyTarget();
        }
        if (target !== null) {
            // console.log("B");
            this.creep.memory.getEnergy.target = target.id;
            this.setMovementData(target.pos, 1, false, false);

            if (target instanceof Structure) {
                if (target instanceof StructureLink) {
                    if (target.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                        this.creep.memory.getEnergy.target = undefined;
                    }
                }
                if (target instanceof StructureContainer || target instanceof StructureStorage) {
                    if (target.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                        this.creep.memory.getEnergy.target = undefined;
                    }
                }
            }

            if (this.creep.pos.isNearTo(target.pos)) {
                if (target instanceof Resource) {
                    this.creep.pickup(target);
                    this.creep.memory.getEnergy.target = undefined;
                } else if (target instanceof Source) {
                    this.creep.harvest(target);
                    this.creep.memory.getEnergy.target = undefined;
                } else if (target instanceof Ruin || target instanceof Tombstone || target instanceof Structure) {
                    this.creep.withdraw(target, RESOURCE_ENERGY);
                    this.creep.memory.getEnergy.target = undefined;
                }
            }
        }
    }
    private getEnergyTarget(): Structure | Resource | Tombstone | Ruin | Source | null {
        if (this.creep === null) {
            return null;
        }
        const requiredAmount: number = 50;
        const creep = this.creep;

        let targets: (Structure | Resource | Tombstone | Ruin)[] = getFromCache(
            "creepRole.energyTargets." + this.creep.memory.home,
            1
        ) as (Structure | Resource | Tombstone | Ruin)[];
        let usedCache = true;
        if (targets === null || targets.length === 0) {
            usedCache = false;
            targets = [];
            targets = targets.concat(
                this.creep.room.find(FIND_RUINS, {
                    filter: (r) => r.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount
                }),
                this.creep.room.find(FIND_TOMBSTONES, {
                    filter: (tb) => tb.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount
                }),
                this.creep.room.find(FIND_DROPPED_RESOURCES, {
                    filter: (dr) => dr.resourceType === RESOURCE_ENERGY && dr.amount >= requiredAmount
                }),
                this.creep.room.find(FIND_STRUCTURES, {
                    filter: (s) => {
                        if (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) {
                            if (s.store.getUsedCapacity(RESOURCE_ENERGY) >= requiredAmount) {
                                return true;
                            } else {
                                return false;
                            }
                        }
                        if (s.structureType === STRUCTURE_LINK) {
                            if (s.pos.isEqualTo(unpackPosition(creep.room.memory.layout.controllerStore))) {
                                if ((s.store.getUsedCapacity(RESOURCE_ENERGY) as number) >= requiredAmount) {
                                    return true;
                                } else {
                                    return false;
                                }
                            } else {
                                const cpos = unpackPosition(creep.room.memory.layout.baseCenter);
                                const lpos = new RoomPosition(cpos.x, cpos.y - 1, cpos.roomName);
                                if (s.pos.isEqualTo(lpos)) {
                                    // if controller is full
                                    if (
                                        s.room.memory.linkStatus === "empty" &&
                                        (s.store.getUsedCapacity(RESOURCE_ENERGY) as number) >= requiredAmount
                                    ) {
                                        return true;
                                    }
                                }
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }
                })
            );
        }

        targets = _.reject(targets, (t: Structure | Resource | Tombstone | Ruin) => t === null);

        if (targets.length > 0 && !usedCache) {
            saveToCache("creepRole.energyTargets." + this.creep.memory.home, targets);
        }

        if (targets.length > 0) {
            const tcreep = this.creep;
            targets.sort((a, b) => {
                if (a === null && b != null) {
                    return 1;
                }
                if (a != null && b === null) {
                    return -1;
                }
                if (a === null && b === null) {
                    return 0;
                }

                if (a === null) {
                    return 1;
                }
                if (b === null) {
                    return -1;
                }

                let arange = tcreep.pos.getRangeTo(a.pos);
                let brange = tcreep.pos.getRangeTo(b.pos);

                if (a instanceof StructureLink) {
                    arange -= 2;
                }
                if (b instanceof StructureLink) {
                    brange -= 2;
                }

                return arange - brange;
            });

            return targets[0];
        } else {
            if (this.creep.getActiveBodyparts(WORK) > 0) {
                return this.creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            } else {
                return null;
            }
        }
    }
    public setMovementData(target: RoomPosition, range: number, flee: boolean, heavy: boolean) {
        if (this.creep == null) {
            return;
        }

        if (this.creep.memory.movementData === undefined) {
            this.creep.memory.movementData = {
                targetPos: packPosition(target),
                range,
                flee,
                heavy
            };
        } else {
            if (
                this.creep.memory.movementData.targetPos !== packPosition(target) ||
                this.creep.memory.movementData.range !== range ||
                this.creep.memory.movementData.flee !== flee ||
                this.creep.memory.movementData.heavy !== heavy
            ) {
                this.creep.memory.movementData = {
                    targetPos: packPosition(target),
                    range,
                    flee,
                    heavy,
                    _path: undefined
                };
            }
        }
    }

    public cancelMovementData() {
        if (this.creep == null) {
            return;
        }
        this.creep.memory.movementData = undefined;
    }

    public smartMove(target: RoomPosition | { pos: RoomPosition }, range?: number) {
        if (this.creep == null) {
            return ERR_INVALID_ARGS;
        }
        if (this.creep.fatigue > 0) {
            return ERR_TIRED;
        }
        if (!(target instanceof RoomPosition)) {
            target = target.pos;
        }
        if (range === undefined) {
            range = 0;
        }

        this.setMovementData(target, range, false, false);

        return 0;
        /* if (this.creep.memory._move !== undefined && this.creep.memory._move.path !== undefined) {
            const nextMove: PathStep = Room.deserializePath(this.creep.memory._move.path)[0];
            if (nextMove !== undefined) {
                const nextPos: RoomPosition = new RoomPosition(nextMove.x, nextMove.y, this.creep.room.name);
                // this.creep.room.visual.circle(nextPos.x,nextPos.y);
                const bCreep: Creep = nextPos.lookFor(LOOK_CREEPS)[0];
                if (bCreep !== undefined && bCreep.name !== this.creep.name && bCreep.fatigue === 0) {
                    if (
                        bCreep.memory !== undefined &&
                        bCreep.memory.checkIdle !== undefined &&
                        bCreep.memory.checkIdle.idleCount > 2
                    ) {
                        bCreep.move(bCreep.pos.getDirectionTo(this.creep.pos));
                    }
                }
            }
            const sMove: PathStep = Room.deserializePath(this.creep.memory._move.path)[1];
            if (sMove !== undefined) {
                const nextPos: RoomPosition = new RoomPosition(sMove.x, sMove.y, this.creep.room.name);
                // this.creep.room.visual.circle(sMove.x,sMove.y);
                const bCreep: Creep = nextPos.lookFor(LOOK_CREEPS)[0];
                if (bCreep !== undefined && bCreep.name !== this.creep.name && bCreep.fatigue === 0) {
                    if (
                        bCreep.memory !== undefined &&
                        bCreep.memory.checkIdle !== undefined &&
                        bCreep.memory.checkIdle.idleCount > 2
                    ) {
                        bCreep.move(bCreep.pos.getDirectionTo(this.creep.pos));
                    }
                }
            }
        }
        return this.creep.moveTo(target, {
            costCallback: (roomName, costMatrix): void | CostMatrix => {
                if (Game.rooms[roomName] !== undefined) {
                    Game.rooms[roomName].find(FIND_MY_CREEPS).forEach((creep) => {
                        if (
                            creep.memory.checkIdle &&
                            (creep.memory.checkIdle.idleCount > 2 || creep.memory.checkIdle.idleCount === 0)
                        ) {
                            costMatrix.set(creep.pos.x, creep.pos.y, 0);
                        }
                    });
                }
                return costMatrix;
            },
            maxOps: 5000,
            reusePath: 25,
            range
        });*/
    }
    public checkIdle() {
        if (this.creep == null) {
            return;
        }

        if (this.creep.memory.checkIdle === undefined) {
            this.creep.memory.checkIdle = {
                idleCount: 0,
                lastPos: this.creep.pos
            };
        }
        if (
            this.creep.pos.isEqualTo(
                new RoomPosition(
                    this.creep.memory.checkIdle.lastPos.x,
                    this.creep.memory.checkIdle.lastPos.y,
                    this.creep.memory.checkIdle.lastPos.roomName
                )
            )
        ) {
            this.creep.memory.checkIdle.idleCount += 1;
        } else {
            this.creep.memory.checkIdle.idleCount = 0;
        }
        this.creep.memory.checkIdle.lastPos = this.creep.pos;
    }
}
