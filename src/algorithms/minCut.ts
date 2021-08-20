const UNWALKABLE = 255;
const EXIT = 1;
const PROTECT = 128;

interface Rectangle {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
}
interface Position {
    x: number;
    y: number;
}
interface Graph {
    level: number[];
    edges: Edge[][];
    rb?: boolean;
    rn?: number;
}
interface Edge {
    to_vertex: number;
    reverse_edge: number;
    capacity: number;
    flow: number;
    u?: number;
}

export function* min_cut(matrix: CostMatrix, protect: Rectangle[]) {
    for (const rect of protect) {
        matrix = apply_bounds(matrix, rect);
    }

    // Clean matrix.

    for (let x = 1; x < 49; x++) {
        for (let y = 1; y < 49; y++) {
            if (matrix.get(x, y) === PROTECT) {
                if (
                    matrix.get(x - 1, y - 1) !== 0 &&
                    matrix.get(x, y - 1) !== 0 &&
                    matrix.get(x + 1, y - 1) !== 0 &&
                    matrix.get(x - 1, y) !== 0 &&
                    matrix.get(x + 1, y) !== 0 &&
                    matrix.get(x - 1, y + 1) !== 0 &&
                    matrix.get(x, y + 1) !== 0 &&
                    matrix.get(x + 1, y + 1) !== 0
                ) {
                    matrix.set(x, y, UNWALKABLE);
                }
            }
        }
    }

    //displayCostMatrix(matrix, "W6N1", undefined, true);

    let graph = create_graph(matrix);

    yield null;

    const source = 2 * 50 * 50;
    const sink = 2 * 50 * 50 + 1;

    graph = yield* calc_min_cut(graph, source, sink);

    let cut_edges = BFSCut(graph, source);

    let positions: Position[] = [];

    for (let i = 0; i < cut_edges.length; i++) {
        let index = cut_edges[i];
        let x = index % 50;
        let y = Math.floor(index / 50);
        positions.push({ x, y });
    }

    return positions;
}

export function create_graph(matrix: CostMatrix) {
    let graph: Graph = {
        edges: [],
        level: []
    };

    for (let i = 0; i < 2 * 50 * 50 + 2; i++) {
        graph.edges.push([]);
        graph.level.push(-1);
    }

    const surroundDeltas = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1]
    ];

    const sourceIndex = 2 * 50 * 50;
    const sinkIndex = 2 * 50 * 50 + 1;

    let topIndex = 0;
    let bottomIndex = 0;

    for (let x = 1; x < 49; x++) {
        for (let y = 1; y < 49; y++) {
            topIndex = y * 50 + x;
            bottomIndex = topIndex + 50 * 50;
            if (matrix.get(x, y) === 0) {
                graph = add_edge(graph, topIndex, bottomIndex, 1);
                for (let i = 0; i < surroundDeltas.length; i++) {
                    let dx = x + surroundDeltas[i][0];
                    let dy = y + surroundDeltas[i][1];
                    if (matrix.get(dx, dy) === 0 || matrix.get(dx, dy) === EXIT) {
                        graph = add_edge(graph, bottomIndex, dy * 50 + dx, Infinity);
                    }
                }
            } else if (matrix.get(x, y) === PROTECT) {
                graph = add_edge(graph, sourceIndex, topIndex, Infinity);
                graph = add_edge(graph, topIndex, bottomIndex, 1);
                for (let i = 0; i < surroundDeltas.length; i++) {
                    let dx = x + surroundDeltas[i][0];
                    let dy = y + surroundDeltas[i][1];
                    if (matrix.get(dx, dy) === 0 || matrix.get(dx, dy) === EXIT) {
                        graph = add_edge(graph, bottomIndex, dy * 50 + dx, Infinity);
                    }
                }
            } else if (matrix.get(x, y) === EXIT) {
                graph = add_edge(graph, topIndex, sinkIndex, Infinity);
            }
        }
    }

    return graph;
}

function add_edge(graph: Graph, from: number, to: number, capacity: number) {
    graph.edges[from].push({
        to_vertex: to,
        reverse_edge: graph.edges[to].length,
        capacity: capacity,
        flow: 0
    });
    graph.edges[to].push({
        to_vertex: from,
        reverse_edge: graph.edges[from].length - 1,
        capacity: 0,
        flow: 0
    });
    return graph;
}

function* calc_min_cut(graph: Graph, source: number, sink: number) {
    if (source === sink) {
        graph.rb = false;
        return graph;
    }
    let count = [];

    graph = BFS(graph, source, sink);
    while (graph.rb === true) {
        yield null;
        for (let i = 0; i < 2 * 50 * 50 + 2; i++) {
            count[i] = 0;
        }
        let flow = 0;
        do {
            graph = DFSFlow(graph, source, Infinity, sink, count);
            flow = graph.rn || 0;
        } while (flow !== 0);

        graph = BFS(graph, source, sink);
    }
    return graph;
}

function BFS(graph: Graph, source: number, sink: number): Graph {
    for (let i = 0; i < graph.level.length; i++) {
        graph.level[i] = -1;
    }
    graph.level[source] = 0;

    let queue = [];
    queue.push(source);

    let u = 0;

    while (queue.length > 0) {
        u = queue.splice(0, 1)[0];
        for (let i = 0; i < graph.edges[u].length; i++) {
            let edge = graph.edges[u][i];
            if (graph.level[edge.to_vertex] < 0 && edge.flow < edge.capacity) {
                graph.level[edge.to_vertex] = graph.level[u] + 1;
                queue.push(edge.to_vertex);
            }
        }
    }

    graph.rb = graph.level[sink] >= 0;
    return graph;
}

function DFSFlow(graph: Graph, u: number, flow: number, sink: number, count: number[]): Graph {
    if (u === sink) {
        graph.rn = flow;
        return graph;
    }

    let flow_till_here = 0;
    let flow_to_sink = 0;
    while (count[u] < graph.edges[u].length) {
        let edge = graph.edges[u][count[u]];
        if (graph.level[edge.to_vertex] === graph.level[u] + 1 && edge.flow < edge.capacity) {
            flow_till_here = Math.min(flow, edge.capacity - edge.flow);
            graph = DFSFlow(graph, edge.to_vertex, flow_till_here, sink, count);
            if (graph.rn === undefined) {
                console.log("dfs big err");
                return graph;
            }
            flow_to_sink = graph.rn;
            if (flow_to_sink > 0) {
                edge.flow += flow_to_sink;
                graph.edges[edge.to_vertex][edge.reverse_edge].flow -= flow_to_sink;
                graph.rn = flow_to_sink;
                return graph;
            }
        }
        count[u]++;
    }
    graph.rn = 0;
    return graph;
}

function BFSCut(graph: Graph, source: number): number[] {
    let edges_in_cut = [];
    for (let i = 0; i < graph.level.length; i++) {
        graph.level[i] = -1;
    }
    graph.level[source] = 1;

    let queue = [];
    queue.push(source);

    let u = 0;

    while (queue.length > 0) {
        u = queue.splice(0, 1)[0];
        for (let i = 0; i < graph.edges[u].length; i++) {
            let edge = graph.edges[u][i];
            if (edge.flow < edge.capacity) {
                if (graph.level[edge.to_vertex] < 1) {
                    graph.level[edge.to_vertex] = 1;
                    queue.push(edge.to_vertex);
                }
            }
            if (edge.flow === edge.capacity && edge.capacity > 0) {
                edge.u = u;
                edges_in_cut.push(edge);
            }
        }
    }

    let min_cut = [];
    for (let i = 0; i < edges_in_cut.length; i++) {
        if (graph.level[edges_in_cut[i].to_vertex] === -1) {
            min_cut.push(edges_in_cut[i].u || -1);
        }
    }

    return min_cut;
}

// Get a matrix with unwalkable and exit tiles filled in
export function get_matrix(roomName: string): CostMatrix {
    const terrain: RoomTerrain = Game.map.getRoomTerrain(roomName);
    const matrix: CostMatrix = new PathFinder.CostMatrix();

    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                matrix.set(x, y, UNWALKABLE);
                continue;
            }
            if (x === 1) {
                if (
                    terrain.get(0, y - 1) !== TERRAIN_MASK_WALL ||
                    terrain.get(0, y) !== TERRAIN_MASK_WALL ||
                    terrain.get(0, y + 1) !== TERRAIN_MASK_WALL
                ) {
                    matrix.set(x, y, EXIT);
                    continue;
                }
            }
            if (x === 48) {
                if (
                    terrain.get(49, y - 1) !== TERRAIN_MASK_WALL ||
                    terrain.get(49, y) !== TERRAIN_MASK_WALL ||
                    terrain.get(49, y + 1) !== TERRAIN_MASK_WALL
                ) {
                    matrix.set(x, y, EXIT);
                    continue;
                }
            }
            if (y === 1) {
                if (
                    terrain.get(x - 1, 0) !== TERRAIN_MASK_WALL ||
                    terrain.get(x, 0) !== TERRAIN_MASK_WALL ||
                    terrain.get(x + 1, 0) !== TERRAIN_MASK_WALL
                ) {
                    matrix.set(x, y, EXIT);
                    continue;
                }
            }
            if (y === 48) {
                if (
                    terrain.get(x - 1, 49) !== TERRAIN_MASK_WALL ||
                    terrain.get(x, 49) !== TERRAIN_MASK_WALL ||
                    terrain.get(x + 1, 49) !== TERRAIN_MASK_WALL
                ) {
                    matrix.set(x, y, EXIT);
                    continue;
                }
            }
            if (x === 0 || x === 49 || y === 0 || y === 49) {
                matrix.set(x, y, UNWALKABLE);
                continue;
            }
        }
    }
    return matrix;
}

// Adds a rectangle of protect to the supplied costmatrix
function apply_bounds(matrix: CostMatrix, rect: Rectangle) {
    for (let x = rect.x1; x <= rect.x2; x++) {
        for (let y = rect.y1; y <= rect.y2; y++) {
            if (matrix.get(x, y) !== UNWALKABLE) {
                matrix.set(x, y, PROTECT);
            }
        }
    }
    return matrix;
}
