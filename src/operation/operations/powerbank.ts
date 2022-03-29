import { Operation } from "operation/operation";

export interface PowerBankOperation extends Operation {
  type: "powerbank";
  id: Id<StructurePowerBank>;
}

function checkOperation(operation: Operation): operation is PowerBankOperation {
  return operation.type === "powerbank" && (operation as PowerBankOperation).id !== undefined;
}

export function powerbank(operation: Operation): boolean {
  if (!checkOperation(operation) || Memory.powerBanks === undefined) {
    return true;
  }
  return false;
}
