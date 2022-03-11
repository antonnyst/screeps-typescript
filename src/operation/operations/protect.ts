import { Operation } from "operation/operation";

export interface ProtectOperation extends Operation {
  type: "protect";
}

export function protect(operation: Operation): void {
  console.log(operation);
}
