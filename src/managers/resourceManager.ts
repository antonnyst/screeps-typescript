import { Manager } from "./manager";
export class ResourceManager implements Manager {
    public run() {
        if (Game.time % 10 === 0) {
            const TerminalRooms:string[] = [];
            for (const r in Game.rooms) {
                if (Memory.rooms[r] != undefined && Memory.rooms[r].resources != undefined && Game.rooms[r].terminal != undefined) {
                    TerminalRooms.push(r);
                }
            }
            //console.log("TerminalRooms:" +JSON.stringify(TerminalRooms));

            for (const resource of RESOURCES_ALL) { 
                const needRooms:{roomName:string,amt:number}[] = [];
                const haveRooms:{roomName:string,amt:number}[] = [];

                for (const r of TerminalRooms) {
                    const a = Memory.rooms[r].resources!.delta[resource];
                    if (a < 0) {
                        needRooms.push({
                            roomName:r,
                            amt:a
                        });
                    } else if (a > 0) {
                        haveRooms.push({
                            roomName:r,
                            amt:a
                        });
                    }
                }

                if (needRooms.length + haveRooms.length > 0) {
                    //console.log(resource + " n" + JSON.stringify(needRooms) + " h" + JSON.stringify(haveRooms)) 
                }

                if (haveRooms.length > 0 && needRooms.length > 0) {
                    for(const nr of needRooms) {
                        const sr = _.sortBy(haveRooms,(hr:{roomName:string,amt:number})=>(Game.map.getRoomLinearDistance(nr.roomName,hr.roomName)))[0];
                        Game.rooms[sr.roomName].terminal!.send(resource,Math.min(-nr.amt,sr.amt),nr.roomName);
                    }
                }

            }
        }
    }
}