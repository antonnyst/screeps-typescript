import { Operation } from "operation/operation";

export interface PowerBankOperation extends Operation {
  type: "powerbank";
  id: Id<StructurePowerBank>;
}

export function powerbank(operation: Operation): void {
  console.log(operation);
}
