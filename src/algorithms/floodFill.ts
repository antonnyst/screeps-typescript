interface Position {
  x: number;
  y: number;
}

const OBSTACLE = 255;
const EMPTY = 0;
const FLOOD = 1;

const NEIGHBOURS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1]
];

export function floodFill(roomName: string, obstacles: Position[]): CostMatrix {
  const terrain = new Room.Terrain(roomName);
  const matrix = new PathFinder.CostMatrix();
  for (let x = 0; x < 50; x++) {
    for (let y = 0; y < 50; y++) {
      if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
        matrix.set(x, y, OBSTACLE);
      } else if (x === 0 || x === 49 || y === 0 || y === 49) {
        matrix.set(x, y, FLOOD);
      }
    }
  }
  for (const pos of obstacles) {
    matrix.set(pos.x, pos.y, OBSTACLE);
  }
  return applyFloodFill(matrix);
}

export function applyFloodFill(matrix: CostMatrix): CostMatrix {
  const floodMatrix = matrix.clone();

  const queue: Position[] = [];

  for (let x = 0; x < 49; x++) {
    for (let y = 0; y < 49; y++) {
      if (floodMatrix.get(x, y) === FLOOD) {
        queue.push({
          x,
          y
        });
      }
    }
  }

  while (queue.length > 0) {
    const pos = queue.shift();
    if (pos === undefined) {
      continue;
    }
    for (const delta of NEIGHBOURS) {
      const x = delta[0] + pos.x;
      const y = delta[1] + pos.y;
      if (floodMatrix.get(x, y) === EMPTY) {
        floodMatrix.set(x, y, FLOOD);
        queue.push({
          x,
          y
        });
      }
    }
  }

  return floodMatrix;
}
