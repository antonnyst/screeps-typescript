export interface Packer<T> {
    pack: (data: T) => string;
    unpack: (data: string) => T;
}
