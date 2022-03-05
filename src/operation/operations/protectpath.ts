import { Operation } from "operation/operation";

export interface ProtectPathOperation extends Operation {
  type: "protectpath";
}

export function protectpath(operation: Operation): void {
  console.log(operation);
}
