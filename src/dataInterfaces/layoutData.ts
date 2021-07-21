import { BasicMineralData, MineralData } from "./mineralData";
import { RoadData } from "./roadData";
import { BasicSourceData, RemoteSourceData, SourceData } from "./sourceData";

export interface LayoutData {
    baseCenter: number;
    controllerStore: number;
    sources: SourceData[];
    mineral: MineralData;
    roads: RoadData[];
    baseType: BaseType;
}
export interface AutoLayoutData extends LayoutData {
    extensions: number[];
    labDirection: LabDirection;
    ramparts: number[];
}

export interface RemoteLayoutData {
    sources: RemoteSourceData[];
}

export interface BasicLayoutData {
    controller: number | undefined;
    sources: BasicSourceData[];
    mineral: BasicMineralData | undefined;
    lairs: number[] | undefined;
}
