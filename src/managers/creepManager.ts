import * as Config from "./../config/config";
import { Manager } from "./manager";
import { CreepRole } from "./../roles/creepRole";
import { roleList } from "./../roles/roleList";
import { config } from "chai";

const cpuArr: { [name: string]: { c: number; cpu: number } } = {};

export class CreepManager implements Manager {
    public run() {
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

            const role: CreepRole = roleList[creep.memory.role];
            if (role === undefined) {
                continue;
            }

            const cpu = Game.cpu.getUsed();

            role.setCreep(creep);
            role.runLogic();

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

                console.log(ca + " = " + nCpuArr[ca].c.toFixed(3) + " per creep");
            }
        }
    }
}
