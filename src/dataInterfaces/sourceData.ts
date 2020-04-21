export interface SourceData {
    id:string;
    pos:number;
    dist:number;
    container:DirectionConstant;
    extensions:DirectionConstant[];
    link:DirectionConstant;
}

export interface BasicSourceData {
    id:string;
    pos:number;
}

export interface RemoteSourceData {
    id:string;
    pos:number;
    dist:number;
    container:DirectionConstant;
}
