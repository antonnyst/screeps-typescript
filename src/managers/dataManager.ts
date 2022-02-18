import { tickData, fullSegmentReset } from "data/data";
import { Manager } from "./manager";

export class DataManager implements Manager {
    minSpeed = 1;
    maxSpeed = 1;
    public run(speed: number) {
        tickData();
        //fullSegmentReset();
    }
}
