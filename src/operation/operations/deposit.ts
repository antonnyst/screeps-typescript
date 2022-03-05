import { Operation } from "operation/operation";

export interface DepositOperation extends Operation {
  type: "deposit";
  id: Id<Deposit>;
}

export function deposit(operation: Operation): void {
  console.log(operation);
}
