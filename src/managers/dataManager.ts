import { Manager } from "./manager";
import { tickData } from "data/data";

export class DataManager implements Manager {
  public minSpeed = 1;
  public maxSpeed = 1;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(_speed: number): void {
    tickData();
  }
}
