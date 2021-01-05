export function ConstructionHandler(room: Room): void {
    if (room.controller !== undefined && room.controller.my && room.memory.roomLevel === 2) {
        room.memory.constructionSites = {};

        let remoteSites: ConstructionSite[] = [];

        for (const r in room.memory.remotes) {
            const remote: string = room.memory.remotes[r];
            if (Game.rooms[remote] !== undefined) {
                remoteSites = remoteSites.concat(Game.rooms[remote].find(FIND_MY_CONSTRUCTION_SITES));
            }
        }

        const sites: ConstructionSite[] = room.find(FIND_MY_CONSTRUCTION_SITES).concat(remoteSites);

        for (const site of sites) {
            room.memory.constructionSites[site.id] = site.pos;
        }
    }
}
