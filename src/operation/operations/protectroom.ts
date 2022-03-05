import { Operation } from "operation/operation";

export interface ProtectRoomOperation extends Operation {
  type: "protectroom";
}

export function protectroom(operation: Operation): void {
  // operation = operation as ProtectRoomOperation;
  console.log(operation);
}
