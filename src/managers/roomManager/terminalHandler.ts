import * as C from "../../config/constants";

export function TerminalHandler(room:Room):void {
    if (Game.time % 10 === 0) {
        //TerminalNeeds(room);
    }
}


/*function TerminalNeeds(room:Room):void {
    if (room.controller === undefined || room.controller.level < 6 || room.terminal === undefined || room.memory.resources === undefined) {
        room.memory.terminalNeeds = undefined;
        return;
    }

    const terminalNeeds:{[resourcetype in ResourceConstant]?: number} = {};
    
    for (const resource of RESOURCES_ALL) {
        const amt:number = room.memory.resources.total[resource];
        let need:number = 0;

        if (resource === RESOURCE_ENERGY) {
            const samt:number = room.memory.resources.total[resource];
            need = (samt > C.TERMINAL_ENERGY_IMPORT_LIMIT) ? C.TERMINAL_ENERGY_MIN : C.TERMINAL_ENERGY_MIN + C.TERMINAL_ENERGY_IMPORT_LIMIT - samt;
        } else if (C.MINERALS.includes(resource)) {
            need = C.TERMINAL_MINERAL_NEED;
        }

        terminalNeeds[resource] = amt - need;
    }

    room.memory.terminalNeeds = terminalNeeds as {[resourcetype in ResourceConstant]: number};
}*/