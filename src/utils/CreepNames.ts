let i = 0;

export function generateName(): string {
  i++;
  return (Game.time % 10000).toString(16) + "-" + i.toString(16);
}
