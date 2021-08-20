import { bucketTarget } from "config/config";
import { BasicRoomData, generateLayout, GenLayoutData } from "layout/layout";
import { RunEvery } from "utils/RunEvery";
import { Manager } from "./manager";

interface LayoutRequest {
    room: string;
    basicRoomData: BasicRoomData;
    callback: (layout: GenLayoutData) => void;
}

interface OngoingWork {
    generator: Generator<string | null, GenLayoutData, unknown>;
    request: LayoutRequest;
    usedCpu: number;
}

export class LayoutManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        if (Game.cpu.bucket < bucketTarget) {
            return;
        }
        if (currentWork === undefined && workQueue.length > 0) {
        }

        if (currentWork === undefined) {
            if (workQueue.length > 0) {
                // Start new work if we have no current work
                let request = workQueue.shift();

                if (request !== undefined) {
                    console.log(`LayoutManager: Starting new work for room ${request.room}`);
                    currentWork = {
                        generator: generateLayout(request.basicRoomData, request.room),
                        request,
                        usedCpu: 0
                    };
                } else {
                    return;
                }
            } else {
                return;
            }
        }
        RunEvery(doWork, "layoutmanagerdowork", 1 / speed);
    }
}

let currentWork: OngoingWork | undefined = undefined;
let workQueue: LayoutRequest[] = [];

export function AddWork(work: LayoutRequest): void {
    workQueue.push(work);
}

export function GetCurrentWorkQueue(): LayoutRequest[] {
    if (currentWork !== undefined) {
        return [currentWork.request].concat(workQueue);
    } else {
        return workQueue;
    }
}

const doWork = () => {
    if (currentWork === undefined) {
        return;
    }
    const cpu = Game.cpu.getUsed();
    while (Game.cpu.getUsed() < Game.cpu.tickLimit * 0.5) {
        try {
            const res = currentWork.generator.next();
            if (res.value !== null) {
                console.log(res.value);
            }
            if (res.done) {
                const used = Game.cpu.getUsed() - cpu;
                currentWork.usedCpu += used;
                console.log(
                    `LayoutManager: Done with work on room ${currentWork.request.room} using ${currentWork.usedCpu} cpu`
                );
                if (res.value !== undefined) {
                    currentWork.request.callback(res.value);
                }
                currentWork = undefined;
                break;
            }
        } catch (error) {
            console.log(`LayoutManager: Error during work ${error}`);
            currentWork = undefined;
            break;
        }
    }
    const used = Game.cpu.getUsed() - cpu;
    if (currentWork !== undefined) {
        currentWork.usedCpu += used;
    }
};
