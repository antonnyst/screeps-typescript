import { Manager } from "./manager";
import { runLogic } from "operation/runner";

export class OperationManager implements Manager {
  public minSpeed = 0.1;
  public maxSpeed = 1;
  public run(speed: number): void {
    runLogic(speed);
  }
}
