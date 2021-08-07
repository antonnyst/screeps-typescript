const times: { [key in string]: number } = {};

export function RunEvery(f: (...n: any) => any, name: string, time: number, ...args: any) {
    if (times[name] === undefined) {
        times[name] = Game.time;
        f(...args);
    }

    if (times[name] <= Game.time - time) {
        times[name] = Game.time;
        f(...args);
    }
}

export function RunNow(f: (...n: any) => any, name: string, ...args: any) {
    times[name] = Game.time;
    f(...args);
}
