const cache: { [name: string]: { data: any; tick: number } } = {};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function saveToCache(name: string, data: any): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  cache[name] = { data, tick: Game.time };
}

export function getFromCache(name: string, tickMargin?: number): any {
  if (tickMargin === undefined) {
    tickMargin = 0;
  }

  const savedData = cache[name];

  if (savedData === undefined) {
    return null;
  } else {
    if (savedData.tick >= Game.time - tickMargin) {
      return savedData.data;
    } else {
      return null;
    }
  }
}
