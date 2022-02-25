// Create a CostMatrix with all walkable squares in a room
export function walkableSquares(room: string): CostMatrix {
  const result = new PathFinder.CostMatrix();
  const terrain = Game.map.getRoomTerrain(room);

  for (let x = 0; x < 50; x++) {
    for (let y = 0; y < 50; y++) {
      if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
        result.set(x, y, 1);
      }
    }
  }

  return result;
}

function isBuildableSquare(x: number, y: number, room: string): boolean {
  const terrain = Game.map.getRoomTerrain(room);

  if (x === 0 || x === 49 || y === 0 || y === 49) {
    return false;
  }

  if (x > 1 && x < 48 && y > 1 && y < 48) {
    return terrain.get(x, y) !== TERRAIN_MASK_WALL;
  }

  if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
    return false;
  }

  if (x === 1) {
    return (
      terrain.get(0, y - 1) === TERRAIN_MASK_WALL &&
      terrain.get(0, y) === TERRAIN_MASK_WALL &&
      terrain.get(0, y + 1) === TERRAIN_MASK_WALL
    );
  }
  if (x === 48) {
    return (
      terrain.get(49, y - 1) === TERRAIN_MASK_WALL &&
      terrain.get(49, y) === TERRAIN_MASK_WALL &&
      terrain.get(49, y + 1) === TERRAIN_MASK_WALL
    );
  }
  if (y === 1) {
    return (
      terrain.get(x - 1, 0) === TERRAIN_MASK_WALL &&
      terrain.get(x, 0) === TERRAIN_MASK_WALL &&
      terrain.get(x + 1, 0) === TERRAIN_MASK_WALL
    );
  }
  if (y === 48) {
    return (
      terrain.get(x - 1, 49) === TERRAIN_MASK_WALL &&
      terrain.get(x, 49) === TERRAIN_MASK_WALL &&
      terrain.get(x + 1, 49) === TERRAIN_MASK_WALL
    );
  }
  return true;
}

// Create a CostMatrix with all buildable squares in a room
export function buildableSquares(room: string): CostMatrix {
  const result = new PathFinder.CostMatrix();

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      if (isBuildableSquare(x, y, room)) {
        result.set(x, y, 1);
      }
    }
  }
  return result;
}

// Apply the distance transformation algorithm
export function applyDistanceTransform(squares: CostMatrix): CostMatrix {
  const result = squares;

  // Forward propagation
  let topleft;
  let top;
  let topright;
  let left;
  let x;
  let y;

  for (y = 0; y < 50; y++) {
    for (x = 0; x < 50; x++) {
      if (squares.get(x, y) !== 0) {
        topleft = result.get(x - 1, y - 1);
        top = result.get(x, y - 1);
        topright = result.get(x + 1, y - 1);
        left = result.get(x - 1, y);

        if (y === 0) {
          topleft = 255;
          top = 255;
          topright = 255;
        }

        if (x === 0) {
          topleft = 255;
          left = 255;
        }

        if (x === 49) {
          topright = 255;
        }

        result.set(x, y, Math.min(topleft, top, topright, left, 254) + 1);
      }
    }
  }

  // Backward propagation
  let mid;
  let right;
  let bottomleft;
  let bottom;
  let bottomright;

  for (y = 49; y >= 0; y--) {
    for (x = 49; x >= 0; x--) {
      mid = result.get(x, y);
      right = result.get(x + 1, y);
      bottomleft = result.get(x - 1, y + 1);
      bottom = result.get(x, y + 1);
      bottomright = result.get(x + 1, y + 1);

      if (x === 0) {
        bottomleft = 255;
      }

      if (x === 49) {
        right = 255;
        bottomright = 255;
      }

      if (y === 49) {
        bottomleft = 255;
        bottom = 255;
        bottomright = 255;
      }

      result.set(x, y, Math.min(mid, right + 1, bottomleft + 1, bottom + 1, bottomright + 1));
    }
  }

  return result;
}

export function displayCostMatrix(
  matrix: CostMatrix,
  room: string,
  color: string | undefined = undefined,
  fixedSize = false
): void {
  const visual = Game.rooms[room].visual;

  let max = 0;
  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      max = Math.max(max, matrix.get(x, y));
    }
  }

  for (let y = 0; y < 50; y++) {
    for (let x = 0; x < 50; x++) {
      const value = matrix.get(x, y);
      if (value > 0) {
        let currColor: string = color || "#ff0000";
        if (color === undefined) {
          const v = 1;
          const s = 0.9;
          const c = v * s;
          const h = (value / max) * 6;
          const X = c * (1 - Math.abs((h % 2) - 1));
          const m = v - s;

          if (0 <= h && h <= 1) {
            currColor =
              "#" +
              Math.round((c + m) * 255).toString(16) +
              Math.round((X + m) * 255).toString(16) +
              Math.round(m * 255).toString(16);
          } else if (1 < h && h <= 2) {
            currColor =
              "#" +
              Math.round((X + m) * 255).toString(16) +
              Math.round((c + m) * 255).toString(16) +
              Math.round(m * 255).toString(16);
          } else if (2 < h && h <= 3) {
            currColor =
              "#" +
              Math.round(m * 255).toString(16) +
              Math.round((c + m) * 255).toString(16) +
              Math.round((X + m) * 255).toString(16);
          } else if (3 < h && h <= 4) {
            currColor =
              "#" +
              Math.round(m * 255).toString(16) +
              Math.round((X + m) * 255).toString(16) +
              Math.round((c + m) * 255).toString(16);
          } else if (4 < h && h <= 5) {
            currColor =
              "#" +
              Math.round((X + m) * 255).toString(16) +
              Math.round(m * 255).toString(16) +
              Math.round((c + m) * 255).toString(16);
          } else if (5 < h && h <= 6) {
            currColor =
              "#" +
              Math.round((c + m) * 255).toString(16) +
              Math.round(m * 255).toString(16) +
              Math.round((X + m) * 255).toString(16);
          }
        }
        visual.text(value.toString(), x, y + 0.5, {
          opacity: 0.25
        });
        visual.circle(x, y, {
          radius: fixedSize ? 0.25 : (value / max) * 0.5,
          fill: currColor
        });
      }
    }
  }
}

export function testDistanceTransform(room: string): void {
  const dt = applyDistanceTransform(walkableSquares(room));
  displayCostMatrix(dt, room, "#ff0000", false);
}

export function distanceTransform(room: string): CostMatrix {
  return applyDistanceTransform(walkableSquares(room));
}
