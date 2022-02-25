const times: { [key in string]: number } = {};

export function RunEvery<T>(f: (...n: T[]) => any, name: string, time: number, ...args: T[]): void {
  if (times[name] === undefined) {
    times[name] = Game.time;
    f(...args);
  }

  if (times[name] <= Game.time - time) {
    times[name] = Game.time;
    f(...args);
  }
}

export function RunNow<T>(f: (...n: T[]) => any, name: string, ...args: T[]): void {
  times[name] = Game.time;
  f(...args);
}
