import { runCreep } from "creeps/runner";
import * as Config from "./../config/config";
import { Manager } from "./manager";

const cpuArr: { [name: string]: { c: number; cpu: number } } = {};

export class CreepManager implements Manager {
    minSpeed = 0.5;
    maxSpeed = 1;
    public run(speed: number) {
        for (const creep in Memory.creeps) {
            if (!Game.creeps[creep]) {
                delete Memory.creeps[creep];
            }
        }

        for (const i in Game.creeps) {
            const creep: Creep = Game.creeps[i];
            if (creep === undefined) {
                continue;
            }

            const cpu = Game.cpu.getUsed();

            runCreep(creep);

            const uCpu = Game.cpu.getUsed() - cpu;

            if (cpuArr[creep.memory.role] === undefined) {
                cpuArr[creep.memory.role] = {
                    c: 0,
                    cpu: 0
                };
            }
            cpuArr[creep.memory.role].c += 1;
            cpuArr[creep.memory.role].cpu += uCpu;
        }
        if (Game.time % 10 === 0 && Config.cpuLog) {
            const nCpuArr: { [name: string]: { c: number; cpu: number; pc: number } } = {};
            for (const ca in cpuArr) {
                nCpuArr[ca] = {
                    c: cpuArr[ca].c,
                    cpu: cpuArr[ca].cpu,
                    pc: cpuArr[ca].cpu / cpuArr[ca].c
                };

                console.log(ca + " = " + nCpuArr[ca].pc.toFixed(3) + " per creep");
            }
        }
    }
}
