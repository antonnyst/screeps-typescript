import { Get, Has, Layer, Prepare, Set } from "./data";
import { Packer } from "./packer";

interface DataInterface<T> {
  has: () => boolean;
  prepare: () => void;
  get: () => T | null;
  set: (value: T | null) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const DataInterface = <T>(dataName: string, packer: Packer<T>, layer: Layer): DataInterface<T> => {
  return {
    has: (): boolean => {
      return Has(dataName);
    },
    prepare: (): void => {
      Prepare(dataName);
    },
    get: (): T | null => {
      const data: string | null = Get(dataName);
      if (data === null) {
        return null;
      }
      return packer.unpack(data);
    },
    set: (value: T | null): void => {
      if (value === null) {
        Set(dataName, "", layer);
        return;
      }
      Set(dataName, packer.pack(value), layer);
    }
  };
};
