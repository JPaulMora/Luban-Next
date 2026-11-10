/**
 * A chiseled letter is the volume under the outline of a glyph.
 * Each border drops inward. Borders facing left or up are steep.
 * Borders facing right or down are shallow. The floor stops at the
 * target depth, so a wide stroke has a flat bottom and a narrow one
 * meets before it gets that deep.
 *
 * Coordinates are y-up. The returned mesh is a closed solid: z is 0
 * on the surface and negative inside the groove.
 */

const MIN_ANGLE = 8;
const MAX_ANGLE = 82;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function cleanRing(ring) {
    if (!Array.isArray(ring) || ring.length < 2) {
        return [];
    }
    const points = [];
    for (const point of ring) {
        if (!Array.isArray(point) || point.length < 2) {
            continue;
        }
        const x = point[0];
        const y = point[1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
        }
        const prev = points[points.length - 1];
        if (prev && prev[0] === x && prev[1] === y) {
            continue;
        }
        points.push([x, y]);
    }
    if (points.length > 1) {
        const first = points[0];
        const last = points[points.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
            points.pop();
        }
    }
    return points.length >= 3 ? points : [];
}

function windingNumber(x, y, ring) {
    let winding = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        if ((yi > y) === (yj > y)) {
            continue;
        }
        const cross = (xj - xi) * (y - yi) - (x - xi) * (yj - yi);
        if (yj > yi) {
            if (cross > 0) {
                winding += 1;
            }
        } else if (cross < 0) {
            winding -= 1;
        }
    }
    return winding;
}

function contains(x, y, rings) {
    let winding = 0;
    for (const ring of rings) {
        winding += windingNumber(x, y, ring);
    }
    return winding !== 0;
}

function segmentDistance(px, py, edge) {
    const dx = edge.bx - edge.ax;
    const dy = edge.by - edge.ay;
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
        t = ((px - edge.ax) * dx + (py - edge.ay) * dy) / len2;
        t = clamp(t, 0, 1);
    }
    const qx = edge.ax + t * dx;
    const qy = edge.ay + t * dy;
    return Math.hypot(px - qx, py - qy);
}

function faceSlope(nx, ny, steep, shallow) {
    const align = (-nx + ny) / Math.SQRT2;
    const towardUpperLeft = clamp((align + 1) / 2, 0, 1);
    return shallow + (steep - shallow) * towardUpperLeft;
}

function buildEdges(rings, steep, shallow) {
    const edges = [];
    const probe = 0.05;
    for (const ring of rings) {
        for (let i = 0; i < ring.length; i += 1) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const len = Math.hypot(dx, dy);
            if (len < 1e-8) {
                continue;
            }
            const rx = dy / len;
            const ry = -dx / len;
            const mx = (a[0] + b[0]) / 2;
            const my = (a[1] + b[1]) / 2;
            const rightIsInside = contains(mx + rx * probe, my + ry * probe, rings);
            const nx = rightIsInside ? -rx : rx;
            const ny = rightIsInside ? -ry : ry;
            const degrees = faceSlope(nx, ny, steep, shallow);
            edges.push({
                ax: a[0],
                ay: a[1],
                bx: b[0],
                by: b[1],
                tan: Math.tan(degrees * Math.PI / 180)
            });
        }
    }
    return edges;
}

function depthAtPoint(x, y, rings, edges, targetDepth) {
    if (!contains(x, y, rings)) {
        return 0;
    }
    let depth = targetDepth;
    for (const edge of edges) {
        const allowed = segmentDistance(x, y, edge) * edge.tan;
        if (allowed < depth) {
            depth = allowed;
        }
    }
    return depth;
}

function triangleArea(positions, a, b, c) {
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const ux = positions[b * 3] - ax;
    const uy = positions[b * 3 + 1] - ay;
    const uz = positions[b * 3 + 2] - az;
    const vx = positions[c * 3] - ax;
    const vy = positions[c * 3 + 1] - ay;
    const vz = positions[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    return {
        x: cx,
        y: cy,
        z: cz,
        length: Math.hypot(cx, cy, cz)
    };
}

/**
 * Closed triangle mesh for one filled outline.
 * `contours` is an array of rings; holes are additional rings.
 * Returns null when the outline has no area.
 */
function chiselContours(contours, options = {}) {
    const steep = clamp(Number(options.steepAngle) || 70, MIN_ANGLE, MAX_ANGLE);
    const shallow = clamp(Number(options.shallowAngle) || 28, MIN_ANGLE, MAX_ANGLE);
    const targetDepth = Number(options.targetDepth);
    if (!(targetDepth > 0)) {
        return null;
    }
    const rings = (contours || []).map(cleanRing).filter((ring) => ring.length >= 3);
    if (rings.length === 0) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
        for (const point of ring) {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        }
    }
    const span = Math.max(maxX - minX, maxY - minY);
    if (!(span > 0)) {
        return null;
    }

    const pitch = options.pitch > 0 ? options.pitch : span / 72;
    const cols = Math.ceil((maxX - minX) / pitch) + 3;
    const rows = Math.ceil((maxY - minY) / pitch) + 3;
    const x0 = minX - pitch;
    const y0 = minY - pitch;
    const edges = buildEdges(rings, steep, shallow);
    const depths = new Float64Array(cols * rows);
    const eps = targetDepth * 1e-4;

    for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
            depths[j * cols + i] = depthAtPoint(x0 + i * pitch, y0 + j * pitch, rings, edges, targetDepth);
        }
    }

    const active = (i, j) => {
        if (i < 0 || j < 0 || i >= cols - 1 || j >= rows - 1) {
            return false;
        }
        return depths[j * cols + i] > eps
            || depths[j * cols + i + 1] > eps
            || depths[(j + 1) * cols + i] > eps
            || depths[(j + 1) * cols + i + 1] > eps;
    };
    const onSeam = (i, j) => {
        if (depths[j * cols + i] > eps) {
            return false;
        }
        let used = false;
        let unused = false;
        const neighbors = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
        for (let n = 0; n < neighbors.length; n += 1) {
            if (active(i + neighbors[n][0], j + neighbors[n][1])) {
                used = true;
            } else {
                unused = true;
            }
        }
        return used && unused;
    };

    const positions = [];
    const indexOf = new Map();
    const vertex = (i, j, slot) => {
        const depth = depths[j * cols + i];
        const usedSlot = onSeam(i, j) ? 0 : slot;
        const key = (j * cols + i) * 2 + usedSlot;
        const existing = indexOf.get(key);
        if (existing !== undefined) {
            return existing;
        }
        const id = positions.length / 3;
        positions.push(x0 + i * pitch, y0 + j * pitch, usedSlot === 0 ? 0 : -depth);
        indexOf.set(key, id);
        return id;
    };

    const indices = [];
    const push = (a, b, c) => {
        if (a === b || b === c || a === c) {
            return;
        }
        if (triangleArea(positions, a, b, c).length < 1e-10) {
            return;
        }
        indices.push(a, b, c);
    };
    const point = (id) => ({
        x: positions[id * 3],
        y: positions[id * 3 + 1],
        z: positions[id * 3 + 2]
    });
    const pushOutward = (a, b, c, insidePoint) => {
        if (a === b || b === c || a === c) {
            return;
        }
        const normal = triangleArea(positions, a, b, c);
        if (normal.length < 1e-10) {
            return;
        }
        const pa = point(a);
        const pb = point(b);
        const pc = point(c);
        const tx = (pa.x + pb.x + pc.x) / 3;
        const ty = (pa.y + pb.y + pc.y) / 3;
        const tz = (pa.z + pb.z + pc.z) / 3;
        const dot = normal.x * (insidePoint.x - tx)
            + normal.y * (insidePoint.y - ty)
            + normal.z * (insidePoint.z - tz);
        if (dot > 0) {
            indices.push(a, c, b);
        } else {
            indices.push(a, b, c);
        }
    };

    const insideOf = (i, j) => {
        let deepest = 0;
        deepest = Math.max(deepest, depths[j * cols + i]);
        deepest = Math.max(deepest, depths[j * cols + i + 1]);
        deepest = Math.max(deepest, depths[(j + 1) * cols + i]);
        deepest = Math.max(deepest, depths[(j + 1) * cols + i + 1]);
        return {
            x: x0 + (i + 0.5) * pitch,
            y: y0 + (j + 0.5) * pitch,
            z: -deepest / 2
        };
    };

    for (let j = 0; j < rows - 1; j += 1) {
        for (let i = 0; i < cols - 1; i += 1) {
            if (!active(i, j)) {
                continue;
            }
            const a = vertex(i, j, 0);
            const b = vertex(i + 1, j, 0);
            const c = vertex(i + 1, j + 1, 0);
            const d = vertex(i, j + 1, 0);
            const a2 = vertex(i, j, 1);
            const b2 = vertex(i + 1, j, 1);
            const c2 = vertex(i + 1, j + 1, 1);
            const d2 = vertex(i, j + 1, 1);
            const depthOf = (col, row) => depths[row * cols + col];
            const zeroDiagonal = depthOf(i, j) <= eps && depthOf(i + 1, j + 1) <= eps;
            if (zeroDiagonal) {
                push(a, b, d);
                push(b, c, d);
                push(a2, d2, b2);
                push(b2, d2, c2);
            } else {
                push(a, b, c);
                push(a, c, d);
                push(a2, c2, b2);
                push(a2, d2, c2);
            }
        }
    }

    const addWall = (i0, j0, i1, j1, cell) => {
        const d0 = depths[j0 * cols + i0];
        const d1 = depths[j1 * cols + i1];
        if (d0 <= eps && d1 <= eps) {
            return;
        }
        const top0 = vertex(i0, j0, 0);
        const top1 = vertex(i1, j1, 0);
        const bot0 = vertex(i0, j0, 1);
        const bot1 = vertex(i1, j1, 1);
        const insidePoint = insideOf(cell.i, cell.j);
        if (d0 > eps && d1 > eps) {
            pushOutward(top0, top1, bot1, insidePoint);
            pushOutward(top0, bot1, bot0, insidePoint);
        } else if (d1 > eps) {
            pushOutward(top0, top1, bot1, insidePoint);
        } else {
            pushOutward(top1, bot0, top0, insidePoint);
        }
    };

    for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols - 1; i += 1) {
            const above = active(i, j);
            const below = active(i, j - 1);
            if (above === below) {
                continue;
            }
            addWall(i, j, i + 1, j, above ? { i, j } : { i, j: j - 1 });
        }
    }
    for (let j = 0; j < rows - 1; j += 1) {
        for (let i = 0; i < cols; i += 1) {
            const right = active(i, j);
            const left = active(i - 1, j);
            if (right === left) {
                continue;
            }
            addWall(i, j, i, j + 1, right ? { i, j } : { i: i - 1, j });
        }
    }

    if (indices.length === 0) {
        return null;
    }
    return { positions, indices };
}

/**
 * Scene coordinates for the CNC view: X to the right, Y up through
 * the stock, Z toward the top of the letter. The mesh is centered
 * on `center`.
 */
function sceneTriangles(mesh, center) {
    const { positions, indices } = mesh;
    const cx = center.x;
    const cy = center.y;
    const out = [];
    for (let i = 0; i < indices.length; i += 3) {
        const order = [indices[i], indices[i + 2], indices[i + 1]];
        for (let k = 0; k < 3; k += 1) {
            const id = order[k] * 3;
            out.push(
                positions[id] - cx,
                positions[id + 2],
                positions[id + 1] - cy
            );
        }
    }
    return out;
}

function contoursFromCommands(commands) {
    const contours = [];
    let ring = null;
    let cx = 0;
    let cy = 0;
    const pushCurve = (x1, y1, x2, y2, x, y, cubic) => {
        const steps = 8;
        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const mt = 1 - t;
            let px;
            let py;
            if (cubic) {
                px = mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x;
                py = mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y;
            } else {
                px = mt * mt * cx + 2 * mt * t * x1 + t * t * x;
                py = mt * mt * cy + 2 * mt * t * y1 + t * t * y;
            }
            ring.push([px, py]);
        }
        cx = x;
        cy = y;
    };

    for (const command of commands || []) {
        if (command.type === 'M') {
            if (ring && ring.length >= 3) {
                contours.push(ring);
            }
            ring = [[command.x, command.y]];
            cx = command.x;
            cy = command.y;
        } else if (!ring) {
            continue;
        } else if (command.type === 'L') {
            ring.push([command.x, command.y]);
            cx = command.x;
            cy = command.y;
        } else if (command.type === 'Q') {
            pushCurve(command.x1, command.y1, 0, 0, command.x, command.y, false);
        } else if (command.type === 'C') {
            pushCurve(command.x1, command.y1, command.x2, command.y2, command.x, command.y, true);
        } else if (command.type === 'Z') {
            contours.push(ring);
            ring = null;
        }
    }
    if (ring && ring.length >= 3) {
        contours.push(ring);
    }
    return contours;
}

module.exports = {
    chiselContours,
    sceneTriangles,
    contoursFromCommands,
    depthAtPoint,
    contains
};
