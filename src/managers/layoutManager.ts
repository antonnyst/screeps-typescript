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
}

export class LayoutManager implements Manager {
    minSpeed = 0.1;
    maxSpeed = 1;
    public run(speed: number) {
        if (Game.cpu.bucket > bucketTarget) {
            if (currentWork === undefined && workQueue.length > 0) {
                // Start new work if we have no current work
                let request = workQueue.shift();

                if (request !== undefined) {
                    console.log("Starting new work for room " + request.room);
                    currentWork = {
                        generator: generateLayout(request.basicRoomData, request.room),
                        request
                    };
                }
            }
            if (currentWork !== undefined) {
                RunEvery(
                    () => {
                        while (Game.cpu.getUsed() < Game.cpu.tickLimit * 0.5) {
                            const res = currentWork!.generator.next();
                            if (res.done) {
                                console.log("Done with work for room " + currentWork!.request.room);
                                if (res.value !== undefined) {
                                    currentWork!.request.callback(res.value);
                                }
                                currentWork = undefined;
                                break;
                            }
                        }
                    },
                    "layoutmanagermain",
                    1 / speed
                );
            }
        }
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
