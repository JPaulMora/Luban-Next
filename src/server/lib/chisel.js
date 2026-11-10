// 45° chisel solid. Each outline edge is one plane, and the two sides of
// a stroke meet at its center. The floor sits 0.2 units under the deepest
// groove. X is to the right, Y is up the letter, and Z is negative into
// the material. Callers pass font commands already laid out.

const earcut = require('earcut');
const polygonClipping = require('polygon-clipping');
const { SkeletonBuilder } = require('straight-skeleton');

const CURVE_SAMPLES = 32;
const FLOOR_GAP_MM = 0.2;

function signedArea(ring) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        area += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
    }
    return area / 2;
}

function simplify(ring) {
    const kept = [];
    const count = ring.length;
    for (let i = 0; i < count; i += 1) {
        const a = ring[(i - 1 + count) % count];
        const b = ring[i];
        const c = ring[(i + 1) % count];
        const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
        if (ab < 1e-4) {
            continue;
        }
        const cross = ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));
        if (Math.abs(cross) <= 1e-4 * (ab + bc)) {
            continue;
        }
        kept.push(b);
    }
    return kept.length >= 3 ? kept : [];
}

function orient(ring, ccw) {
    const positive = signedArea(ring) > 0;
    if (positive === ccw) {
        return ring;
    }
    return ring.slice().reverse();
}

function pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const yi = ring[i][1];
        const yj = ring[j][1];
        if ((yi > y) === (yj > y)) {
            continue;
        }
        const xi = ring[i][0];
        const xj = ring[j][0];
        const xCross = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (x < xCross) {
            inside = !inside;
        }
    }
    return inside;
}

function ringsFromCommands(commands, scale, originX, originY) {
    const mapPoint = (x, y) => [(x - originX) * scale, (originY - y) * scale];
    const rings = [];
    let ring = null;
    let cx = 0;
    let cy = 0;
    const put = (x, y) => {
        const point = mapPoint(x, y);
        const prev = ring[ring.length - 1];
        if (!prev || Math.hypot(prev[0] - point[0], prev[1] - point[1]) > 1e-6) {
            ring.push(point);
        }
        cx = x;
        cy = y;
    };

    const pushCurve = (point) => {
        const prev = ring[ring.length - 1];
        if (!prev || Math.hypot(prev[0] - point[0], prev[1] - point[1]) > 1e-6) {
            ring.push(point);
        }
    };
    const sampleQuadratic = (p0, p1, p2) => {
        for (let i = 1; i <= CURVE_SAMPLES; i += 1) {
            const t = i / CURVE_SAMPLES;
            const mt = 1 - t;
            pushCurve([
                (mt * mt * p0[0]) + (2 * mt * t * p1[0]) + (t * t * p2[0]),
                (mt * mt * p0[1]) + (2 * mt * t * p1[1]) + (t * t * p2[1])
            ]);
        }
    };
    const sampleCubic = (p0, p1, p2, p3) => {
        for (let i = 1; i <= CURVE_SAMPLES; i += 1) {
            const t = i / CURVE_SAMPLES;
            const mt = 1 - t;
            pushCurve([
                (mt * mt * mt * p0[0]) + (3 * mt * mt * t * p1[0]) + (3 * mt * t * t * p2[0]) + (t * t * t * p3[0]),
                (mt * mt * mt * p0[1]) + (3 * mt * mt * t * p1[1]) + (3 * mt * t * t * p2[1]) + (t * t * t * p3[1])
            ]);
        }
    };

    commands.forEach((command) => {
        if (command.type === 'M') {
            if (ring && ring.length >= 3) {
                rings.push(ring);
            }
            ring = [];
            put(command.x, command.y);
        } else if (!ring) {
            // A command before the first move is not part of an outline.
        } else if (command.type === 'L') {
            put(command.x, command.y);
        } else if (command.type === 'Q') {
            sampleQuadratic(mapPoint(cx, cy), mapPoint(command.x1, command.y1), mapPoint(command.x, command.y));
            cx = command.x;
            cy = command.y;
        } else if (command.type === 'C') {
            sampleCubic(
                mapPoint(cx, cy),
                mapPoint(command.x1, command.y1),
                mapPoint(command.x2, command.y2),
                mapPoint(command.x, command.y)
            );
            cx = command.x;
            cy = command.y;
        } else if (command.type === 'Z' && ring.length >= 3) {
            const first = ring[0];
            const last = ring[ring.length - 1];
            if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
                ring.pop();
            }
            rings.push(ring);
            ring = null;
        }
    });
    if (ring && ring.length >= 3) {
        rings.push(ring);
    }
    return rings.map(simplify).filter((item) => item.length >= 3);
}

function shapesFromRings(rings) {
    const items = rings.map((ring) => ({ ring }));
    items.forEach((item) => {
        item.parent = items.find((other) => other !== item
            && Math.abs(signedArea(other.ring)) > Math.abs(signedArea(item.ring))
            && pointInRing(item.ring[0][0], item.ring[0][1], other.ring)) || null;
    });
    const shapes = [];
    const shapeOf = new Map();
    items.filter((item) => !item.parent).forEach((item) => {
        const shape = { outer: orient(item.ring, true), holes: [] };
        shapeOf.set(item, shape);
        shapes.push(shape);
    });
    items.filter((item) => item.parent).forEach((item) => {
        const shape = shapeOf.get(item.parent);
        if (shape) {
            shape.holes.push(orient(item.ring, false));
        }
    });
    return shapes;
}

function closeRing(ring) {
    const closed = ring.map((point) => [point[0], point[1]]);
    const first = closed[0];
    const last = closed[closed.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        closed.push([first[0], first[1]]);
    }
    return closed;
}

function heightOf(point, distances) {
    const key = `${point.X.toFixed(5)},${point.Y.toFixed(5)}`;
    if (distances.has(key)) {
        return distances.get(key);
    }
    return 0;
}

function roundMm(value) {
    return Math.round(value * 1e5) / 1e5;
}

function shiftShape(shape) {
    let minX = Infinity;
    let minY = Infinity;
    const rings = [shape.outer, ...shape.holes];
    rings.forEach((ring) => {
        ring.forEach((point) => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
        });
    });
    const mapRing = (ring) => ring.map((point) => [point[0] - minX, point[1] - minY]);
    return {
        outer: mapRing(shape.outer),
        holes: shape.holes.map(mapRing),
        minX,
        minY
    };
}

function cleanRing(ring, snap) {
    const out = [];
    ring.forEach((point) => {
        const next = snap ? [roundMm(point[0]), roundMm(point[1])] : [point[0], point[1]];
        const prev = out[out.length - 1];
        if (!prev || Math.hypot(prev[0] - next[0], prev[1] - next[1]) > 1e-8) {
            out.push(next);
        }
    });
    if (out.length > 1) {
        const first = out[0];
        const last = out[out.length - 1];
        if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 1e-8) {
            out.pop();
        }
    }
    return out;
}

function prepareShape(local, snap) {
    return {
        outer: cleanRing(local.outer, snap),
        holes: local.holes.map((hole) => cleanRing(hole, snap)).filter((hole) => hole.length >= 3),
        minX: local.minX,
        minY: local.minY
    };
}

function turnDegrees(ring, index) {
    const count = ring.length;
    const previous = ring[(index - 1 + count) % count];
    const point = ring[index];
    const next = ring[(index + 1) % count];
    const abx = point[0] - previous[0];
    const aby = point[1] - previous[1];
    const bcx = next[0] - point[0];
    const bcy = next[1] - point[1];
    const cross = (abx * bcy) - (aby * bcx);
    const dot = (abx * bcx) + (aby * bcy);
    return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI);
}

function keepCorners(ring, stride) {
    if (ring.length < 8) {
        return ring.map((point) => [point[0], point[1]]);
    }
    const out = [];
    let since = stride;
    for (let i = 0; i < ring.length; i += 1) {
        if (turnDegrees(ring, i) >= 20 || since >= stride) {
            out.push([ring[i][0], ring[i][1]]);
            since = 1;
        } else {
            since += 1;
        }
    }
    return out.length >= 3 ? out : ring.map((point) => [point[0], point[1]]);
}

function dedupeFace(face) {
    const tolerance = 1e-5;
    const out = [];
    face.forEach((point) => {
        const prev = out[out.length - 1];
        const gap = prev ? Math.hypot(prev[0] - point[0], prev[1] - point[1], prev[2] - point[2]) : Infinity;
        if (gap > tolerance) {
            out.push(point.slice());
        }
    });
    if (out.length > 1) {
        const first = out[0];
        const last = out[out.length - 1];
        if (Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) <= tolerance) {
            out.pop();
        }
    }
    return out;
}

function boundarySegments(shape) {
    const segments = [];
    [shape.outer, ...shape.holes].forEach((ring) => {
        for (let i = 0; i < ring.length; i += 1) {
            segments.push([ring[i], ring[(i + 1) % ring.length]]);
        }
    });
    return segments;
}

function onSegment(point, start, end) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const len2 = (dx * dx) + (dy * dy) || 1;
    let t = (((point[0] - start[0]) * dx) + ((point[1] - start[1]) * dy)) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = start[0] + (t * dx);
    const py = start[1] + (t * dy);
    return (((point[0] - px) ** 2) + ((point[1] - py) ** 2)) < 1e-6;
}

function edgeOnBoundary(a, b, segments) {
    return segments.some((segment) => onSegment(a, segment[0], segment[1])
        && onSegment(b, segment[0], segment[1]));
}

function distanceToRing(point, ring) {
    let best = Infinity;
    for (let i = 0; i < ring.length; i += 1) {
        const start = ring[i];
        const end = ring[(i + 1) % ring.length];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const len2 = (dx * dx) + (dy * dy) || 1;
        let t = (((point[0] - start[0]) * dx) + ((point[1] - start[1]) * dy)) / len2;
        t = Math.max(0, Math.min(1, t));
        const gap = Math.hypot(point[0] - (start[0] + (t * dx)), point[1] - (start[1] + (t * dy)));
        if (gap < best) {
            best = gap;
        }
    }
    return best;
}

function escapesOutline(faces, shape) {
    for (let faceIndex = 0; faceIndex < faces.length; faceIndex += 1) {
        const face = faces[faceIndex];
        for (let pointIndex = 0; pointIndex < face.length; pointIndex += 1) {
            const point = face[pointIndex];
            const outside = !pointInRing(point[0], point[1], shape.outer)
                && distanceToRing(point, shape.outer) > 0.05;
            if (outside) {
                return true;
            }
            for (let holeIndex = 0; holeIndex < shape.holes.length; holeIndex += 1) {
                const hole = shape.holes[holeIndex];
                if (pointInRing(point[0], point[1], hole) && distanceToRing(point, hole) > 0.05) {
                    return true;
                }
            }
        }
    }
    return false;
}

function roofGaps(faces, shape) {
    const segments = boundarySegments(shape);
    const edges = new Map();
    faces.forEach((face) => {
        const flat = [];
        face.forEach((point) => {
            flat.push(point[0], point[1]);
        });
        const indices = earcut(flat, null, 2);
        for (let i = 0; i < indices.length; i += 3) {
            const tri = [face[indices[i]], face[indices[i + 1]], face[indices[i + 2]]];
            const nz = ((tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]))
                - ((tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0]));
            if (Math.abs(nz) < 1e-10) {
                continue;
            }
            for (let edge = 0; edge < 3; edge += 1) {
                const a = tri[edge];
                const b = tri[(edge + 1) % 3];
                const ka = a.map((value) => value.toFixed(4)).join(',');
                const kb = b.map((value) => value.toFixed(4)).join(',');
                const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
                const record = edges.get(id) || { count: 0, a, b };
                record.count += 1;
                edges.set(id, record);
            }
        }
    });
    let open = 0;
    let multi = 0;
    edges.forEach((record) => {
        if (record.count > 2) {
            multi += 1;
        } else if (record.count === 1 && !edgeOnBoundary(record.a, record.b, segments)) {
            open += 1;
        }
    });
    return open + multi;
}

function sealRidges(faces, shape) {
    const segments = boundarySegments(shape);
    const list = faces.map(dedupeFace).filter((face) => face.length >= 3);
    for (let pass = 0; pass < 4; pass += 1) {
        const open = [];
        list.forEach((face, faceIndex) => {
            for (let i = 0; i < face.length; i += 1) {
                const a = face[i];
                const b = face[(i + 1) % face.length];
                if (edgeOnBoundary(a, b, segments)) {
                    continue;
                }
                const ka = a.map((value) => value.toFixed(4)).join(',');
                const kb = b.map((value) => value.toFixed(4)).join(',');
                const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
                let record = open.find((item) => item.id === id);
                if (!record) {
                    record = {
                        id, count: 0, a, b, faceIndex, index: i
                    };
                    open.push(record);
                }
                record.count += 1;
            }
        });
        const singles = open.filter((item) => item.count === 1);
        let best = null;
        singles.forEach((edge) => {
            const ab = [edge.b[0] - edge.a[0], edge.b[1] - edge.a[1], edge.b[2] - edge.a[2]];
            const len2 = (ab[0] * ab[0]) + (ab[1] * ab[1]) + (ab[2] * ab[2]);
            if (len2 < 1e-8) {
                return;
            }
            singles.forEach((other) => {
                if (other === edge) {
                    return;
                }
                [other.a, other.b].forEach((point) => {
                    const t = (((point[0] - edge.a[0]) * ab[0])
                        + ((point[1] - edge.a[1]) * ab[1])
                        + ((point[2] - edge.a[2]) * ab[2])) / len2;
                    if (t <= 0.02 || t >= 0.98) {
                        return;
                    }
                    const projected = [
                        edge.a[0] + (t * ab[0]),
                        edge.a[1] + (t * ab[1]),
                        edge.a[2] + (t * ab[2])
                    ];
                    const distance = Math.hypot(
                        point[0] - projected[0],
                        point[1] - projected[1],
                        point[2] - projected[2]
                    );
                    if (distance < 0.35 && (!best || distance < best.distance)) {
                        best = {
                            edge, point, projected, distance
                        };
                    }
                });
            });
        });
        if (!best) {
            break;
        }
        const before = roofGaps(list, shape);
        const snapshot = list.map((face) => face.map((point) => point.slice()));
        const source = [best.point[0], best.point[1], best.point[2]];
        list.forEach((face) => {
            face.forEach((vertex) => {
                const near = Math.hypot(
                    vertex[0] - source[0],
                    vertex[1] - source[1],
                    vertex[2] - source[2]
                ) < 0.02;
                if (near) {
                    vertex[0] = best.projected[0];
                    vertex[1] = best.projected[1];
                    vertex[2] = best.projected[2];
                }
            });
        });
        const host = list[best.edge.faceIndex];
        const present = host.some((vertex) => Math.hypot(
            vertex[0] - best.projected[0],
            vertex[1] - best.projected[1],
            vertex[2] - best.projected[2]
        ) < 1e-5);
        if (!present) {
            host.splice(best.edge.index + 1, 0, best.projected.slice());
        }
        const after = roofGaps(list, shape);
        if (after >= before) {
            snapshot.forEach((face, index) => {
                list[index] = face;
            });
            break;
        }
    }
    return list;
}

function skeletonFaces(shape) {
    const multi = [[
        shape.outer.map((point) => [point[0], point[1]]),
        ...shape.holes.map((hole) => hole.map((point) => [point[0], point[1]]))
    ]];
    const skeleton = SkeletonBuilder.BuildFromGeoJSON(multi);
    const distances = new Map();
    for (const [point, distance] of skeleton.Distances) {
        distances.set(`${point.X.toFixed(5)},${point.Y.toFixed(5)}`, distance);
    }
    const faces = [];
    skeleton.Edges.forEach((edge) => {
        const face = [];
        edge.Polygon.forEach((point) => {
            face.push([point.X, point.Y, -heightOf(point, distances)]);
        });
        if (face.length >= 3 && Math.abs(signedArea(face)) > 1e-6) {
            faces.push(face);
        }
    });
    return faces;
}

function simplifyOpen(points, tolerance) {
    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
        const range = stack.pop();
        const from = range[0];
        const to = range[1];
        const startPoint = points[from];
        const endPoint = points[to];
        const dx = endPoint[0] - startPoint[0];
        const dy = endPoint[1] - startPoint[1];
        const length = Math.hypot(dx, dy) || 1;
        let max = 0;
        let index = -1;
        for (let i = from + 1; i < to; i += 1) {
            const point = points[i];
            const gap = Math.abs(((point[0] - startPoint[0]) * dy) - ((point[1] - startPoint[1]) * dx)) / length;
            if (gap > max) {
                max = gap;
                index = i;
            }
        }
        if (index >= 0 && max > tolerance) {
            keep[index] = true;
            stack.push([from, index], [index, to]);
        }
    }
    const out = [];
    for (let i = 0; i < points.length; i += 1) {
        if (keep[i]) {
            out.push([points[i][0], points[i][1]]);
        }
    }
    return out;
}

// Closed-ring Douglas–Peucker. A dense counter (Arial Black "a") makes
// straight-skeleton throw an empty Error unless the curves are thinned.
function simplifyClosed(ring, tolerance) {
    if (ring.length < 8 || !(tolerance > 0)) {
        return ring.map((point) => [point[0], point[1]]);
    }
    let start = 0;
    for (let i = 1; i < ring.length; i += 1) {
        const point = ring[i];
        const best = ring[start];
        if (point[0] < best[0] - 1e-9 || (Math.abs(point[0] - best[0]) <= 1e-9 && point[1] < best[1])) {
            start = i;
        }
    }
    const rotated = ring.slice(start).concat(ring.slice(0, start));
    let far = 1;
    let farDistance = 0;
    for (let i = 1; i < rotated.length; i += 1) {
        const distance = Math.hypot(rotated[i][0] - rotated[0][0], rotated[i][1] - rotated[0][1]);
        if (distance > farDistance) {
            farDistance = distance;
            far = i;
        }
    }
    const first = simplifyOpen(rotated.slice(0, far + 1), tolerance);
    const second = simplifyOpen(rotated.slice(far).concat([[rotated[0][0], rotated[0][1]]]), tolerance);
    const out = first.concat(second.slice(1, -1));
    return out.length >= 3 ? out : ring.map((point) => [point[0], point[1]]);
}

function simplifyShape(shape) {
    const rings = [shape.outer, ...shape.holes];
    let size = 0;
    rings.forEach((ring) => {
        ring.forEach((point) => {
            size = Math.max(size, Math.abs(point[0]), Math.abs(point[1]));
        });
    });
    const tolerance = Math.max(size * 0.0015, 1e-4);
    return {
        outer: simplifyClosed(shape.outer, tolerance),
        holes: shape.holes
            .map((hole) => simplifyClosed(hole, tolerance))
            .filter((hole) => hole.length >= 3),
        minX: shape.minX,
        minY: shape.minY
    };
}

function shapeCandidates(shape) {
    const shifted = simplifyShape(shiftShape(shape));
    const candidates = [prepareShape(shifted, false), prepareShape(shifted, true)];
    [2, 3, 4].forEach((stride) => {
        candidates.push({
            outer: keepCorners(shifted.outer, stride),
            holes: shifted.holes.map((hole) => keepCorners(hole, stride)).filter((hole) => hole.length >= 3),
            minX: shifted.minX,
            minY: shifted.minY
        });
    });
    return candidates.filter((candidate) => candidate.outer.length >= 3);
}

function roofFaces(shapes) {
    const faces = [];
    const used = [];
    shapes.forEach((shape) => {
        const candidates = shapeCandidates(shape);
        let built = null;
        let chosen = null;
        let failure = null;
        let bestGaps = Infinity;
        for (let i = 0; i < candidates.length; i += 1) {
            try {
                const sealed = sealRidges(skeletonFaces(candidates[i]), candidates[i]);
                let gaps = roofGaps(sealed, candidates[i]);
                if (escapesOutline(sealed, candidates[i])) {
                    gaps += 100000;
                }
                if (gaps < bestGaps) {
                    bestGaps = gaps;
                    built = sealed;
                    chosen = candidates[i];
                }
                if (gaps === 0) {
                    break;
                }
            } catch (error) {
                failure = error;
            }
        }
        if (!built) {
            throw failure;
        }
        const move = (point) => [point[0] + chosen.minX, point[1] + chosen.minY];
        built.forEach((face) => {
            faces.push(face.map((point) => [point[0] + chosen.minX, point[1] + chosen.minY, point[2]]));
        });
        used.push({
            outer: chosen.outer.map(move),
            holes: chosen.holes.map((hole) => hole.map(move))
        });
    });
    return { faces, shapes: used };
}

function addFace(triangles, face, upward) {
    const flat = [];
    face.forEach((point) => {
        flat.push(point[0], point[1]);
    });
    const indices = earcut(flat, null, 2);
    for (let i = 0; i < indices.length; i += 3) {
        const a = face[indices[i]];
        const b = face[indices[i + 1]];
        const c = face[indices[i + 2]];
        const nz = ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));
        if (Math.abs(nz) < 1e-10) {
            continue;
        }
        if ((nz > 0) === upward) {
            triangles.push(...a, ...b, ...c);
        } else {
            triangles.push(...a, ...c, ...b);
        }
    }
}

function addQuad(triangles, a, b, c, d) {
    triangles.push(...a, ...b, ...c, ...a, ...c, ...d);
}

function closeMesh(triangles) {
    const tolerance = 0.005;
    const buckets = new Map();
    const vertices = [];
    const indexOf = (point) => {
        const ix = Math.floor(point[0] / tolerance);
        const iy = Math.floor(point[1] / tolerance);
        const iz = Math.floor(point[2] / tolerance);
        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                for (let dz = -1; dz <= 1; dz += 1) {
                    const list = buckets.get(`${ix + dx},${iy + dy},${iz + dz}`);
                    if (!list) {
                        continue;
                    }
                    for (let i = 0; i < list.length; i += 1) {
                        const vertex = vertices[list[i]];
                        const gap = Math.hypot(vertex[0] - point[0], vertex[1] - point[1], vertex[2] - point[2]);
                        if (gap <= tolerance) {
                            return list[i];
                        }
                    }
                }
            }
        }
        const index = vertices.length;
        vertices.push([point[0], point[1], point[2]]);
        const key = `${ix},${iy},${iz}`;
        const list = buckets.get(key) || [];
        list.push(index);
        buckets.set(key, list);
        return index;
    };
    let indexed = [];
    for (let i = 0; i < triangles.length; i += 9) {
        const ids = [0, 1, 2].map((corner) => indexOf([
            triangles[i + (corner * 3)],
            triangles[i + (corner * 3) + 1],
            triangles[i + (corner * 3) + 2]
        ]));
        if (new Set(ids).size === 3) {
            indexed.push(ids);
        }
    }
    for (let pass = 0; pass < 8; pass += 1) {
        const edgeMap = new Map();
        indexed.forEach((ids) => {
            for (let edge = 0; edge < 3; edge += 1) {
                const a = ids[edge];
                const b = ids[(edge + 1) % 3];
                const key = a < b ? `${a}>${b}` : `${b}>${a}`;
                const record = edgeMap.get(key) || { a, b, count: 0 };
                record.count += 1;
                edgeMap.set(key, record);
            }
        });
        let best = null;
        edgeMap.forEach((edge) => {
            if (edge.count === 2) {
                return;
            }
            const start = vertices[edge.a];
            const end = vertices[edge.b];
            const ab = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
            const len2 = (ab[0] * ab[0]) + (ab[1] * ab[1]) + (ab[2] * ab[2]);
            if (len2 < 1e-8) {
                return;
            }
            vertices.forEach((point, pointIndex) => {
                if (pointIndex === edge.a || pointIndex === edge.b) {
                    return;
                }
                const t = (((point[0] - start[0]) * ab[0])
                    + ((point[1] - start[1]) * ab[1])
                    + ((point[2] - start[2]) * ab[2])) / len2;
                if (t <= 0.02 || t >= 0.98) {
                    return;
                }
                const projected = [
                    start[0] + (t * ab[0]),
                    start[1] + (t * ab[1]),
                    start[2] + (t * ab[2])
                ];
                const distance = Math.hypot(point[0] - projected[0], point[1] - projected[1], point[2] - projected[2]);
                if (distance < 0.05 && (!best || distance < best.distance)) {
                    best = { edge, pointIndex, distance };
                }
            });
        });
        if (!best) {
            break;
        }
        const next = [];
        indexed.forEach((ids) => {
            const first = ids.indexOf(best.edge.a);
            const second = ids.indexOf(best.edge.b);
            const adjacent = first >= 0 && second >= 0
                && ((first + 1) % 3 === second || (second + 1) % 3 === first);
            if (!adjacent) {
                next.push(ids);
                return;
            }
            const tip = ids.find((vertex) => vertex !== best.edge.a && vertex !== best.edge.b);
            if ((first + 1) % 3 === second) {
                next.push([best.edge.a, best.pointIndex, tip], [best.pointIndex, best.edge.b, tip]);
            } else {
                next.push([best.edge.b, best.pointIndex, tip], [best.pointIndex, best.edge.a, tip]);
            }
        });
        indexed = next.filter((ids) => new Set(ids).size === 3);
    }
    const flat = [];
    indexed.forEach((ids) => {
        ids.forEach((index) => {
            flat.push(...vertices[index]);
        });
    });
    return flat;
}

function buildSolid(shapes, width, height) {
    const roof = roofFaces(shapes);
    const faces = roof.faces;
    const triangles = [];
    faces.forEach((face) => addFace(triangles, face, true));

    const box = [[
        [0, 0],
        [width, 0],
        [width, height],
        [0, height],
        [0, 0]
    ]];
    const letters = roof.shapes.map((shape) => [
        closeRing(shape.outer),
        ...shape.holes.map(closeRing)
    ]);
    const flat = polygonClipping.difference(box, ...letters);
    flat.forEach((polygon) => {
        const outer = polygon[0].slice(0, -1);
        const holes = polygon.slice(1).map((ring) => ring.slice(0, -1));
        const face = outer.map((point) => [point[0], point[1], 0]);
        const holeStarts = [];
        holes.forEach((hole) => {
            holeStarts.push(face.length);
            hole.forEach((point) => face.push([point[0], point[1], 0]));
        });
        const flatXY = [];
        face.forEach((point) => flatXY.push(point[0], point[1]));
        const indices = earcut(flatXY, holeStarts, 2);
        for (let i = 0; i < indices.length; i += 3) {
            const a = face[indices[i]];
            const b = face[indices[i + 1]];
            const c = face[indices[i + 2]];
            const nz = ((b[0] - a[0]) * (c[1] - a[1])) - ((b[1] - a[1]) * (c[0] - a[0]));
            if (nz > 0) {
                triangles.push(...a, ...b, ...c);
            } else if (nz < 0) {
                triangles.push(...a, ...c, ...b);
            }
        }
    });

    const boundary = [[], [], [], []];
    const consider = (point) => {
        if (Math.abs(point[2]) > 1e-4) {
            return;
        }
        const x = point[0];
        const y = point[1];
        if (Math.abs(y) <= 1e-4) {
            boundary[0].push(x);
        } else if (Math.abs(x - width) <= 1e-4) {
            boundary[1].push(y);
        } else if (Math.abs(y - height) <= 1e-4) {
            boundary[2].push(x);
        } else if (Math.abs(x) <= 1e-4) {
            boundary[3].push(y);
        }
    };
    faces.forEach((face) => face.forEach(consider));
    flat.forEach((polygon) => polygon.forEach((ring) => ring.forEach((point) => consider([point[0], point[1], 0]))));
    consider([0, 0, 0]);
    consider([width, 0, 0]);
    consider([width, height, 0]);
    consider([0, height, 0]);
    const unique = (values) => {
        const sorted = values.slice().sort((a, b) => a - b);
        const out = [];
        sorted.forEach((value) => {
            if (!out.length || Math.abs(value - out[out.length - 1]) > 1e-4) {
                out.push(value);
            }
        });
        return out;
    };
    const loop = [];
    const pushLoop = (x, y) => {
        const last = loop[loop.length - 1];
        if (!last || Math.hypot(last[0] - x, last[1] - y) > 1e-4) {
            loop.push([x, y]);
        }
    };
    unique(boundary[0]).forEach((x) => pushLoop(x, 0));
    unique(boundary[1]).forEach((y) => pushLoop(width, y));
    unique(boundary[2]).reverse().forEach((x) => pushLoop(x, height));
    unique(boundary[3]).reverse().forEach((y) => pushLoop(0, y));
    if (loop.length > 1 && Math.hypot(loop[0][0] - loop[loop.length - 1][0], loop[0][1] - loop[loop.length - 1][1]) > 1e-4) {
        loop.push([loop[0][0], loop[0][1]]);
    }
    let deepest = 0;
    faces.forEach((face) => {
        face.forEach((point) => {
            deepest = Math.min(deepest, point[2]);
        });
    });
    const floorZ = deepest - FLOOR_GAP_MM;
    const floor = loop.slice(0, -1).map((point) => [point[0], point[1], floorZ]);
    addFace(triangles, floor, false);
    for (let i = 0; i < loop.length - 1; i += 1) {
        const p = loop[i];
        const q = loop[i + 1];
        addQuad(
            triangles,
            [q[0], q[1], 0],
            [p[0], p[1], 0],
            [p[0], p[1], floorZ],
            [q[0], q[1], floorZ]
        );
    }

    return { triangles: closeMesh(triangles), faces, thickness: -floorZ };
}

function stlBuffer(triangles) {
    const count = triangles.length / 9;
    const buffer = Buffer.alloc(84 + (count * 50));
    buffer.write('chisel', 0, 'ascii');
    buffer.writeUInt32LE(count, 80);
    let offset = 84;
    for (let i = 0; i < triangles.length; i += 9) {
        const ax = triangles[i];
        const ay = triangles[i + 1];
        const az = triangles[i + 2];
        const bx = triangles[i + 3];
        const by = triangles[i + 4];
        const bz = triangles[i + 5];
        const cx = triangles[i + 6];
        const cy = triangles[i + 7];
        const cz = triangles[i + 8];
        let nx = ((by - ay) * (cz - az)) - ((bz - az) * (cy - ay));
        let ny = ((bz - az) * (cx - ax)) - ((bx - ax) * (cz - az));
        let nz = ((bx - ax) * (cy - ay)) - ((by - ay) * (cx - ax));
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        buffer.writeFloatLE(nx, offset);
        buffer.writeFloatLE(ny, offset + 4);
        buffer.writeFloatLE(nz, offset + 8);
        for (let k = 0; k < 9; k += 1) {
            buffer.writeFloatLE(triangles[i + k], offset + 12 + (k * 4));
        }
        offset += 50;
    }
    return buffer;
}

function solidFromCommands(commands, scale, box) {
    const rings = ringsFromCommands(commands, scale, box.x1, box.y2);
    let width = (box.x2 - box.x1) * scale;
    let height = (box.y2 - box.y1) * scale;
    rings.forEach((ring) => {
        ring.forEach((point) => {
            width = Math.max(width, point[0]);
            height = Math.max(height, point[1]);
        });
    });
    if (!(width > 0) || !(height > 0)) {
        return null;
    }
    const solid = buildSolid(shapesFromRings(rings), width, height);
    return {
        triangles: solid.triangles,
        faces: solid.faces,
        thickness: solid.thickness,
        width,
        height
    };
}

// Luban mesh axes: X right, Z up the letter, Y into the stock.
// The flat face stays at Y=0 and the groove is positive Y.
function sceneTriangles(triangles) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < triangles.length; i += 3) {
        minX = Math.min(minX, triangles[i]);
        maxX = Math.max(maxX, triangles[i]);
        minY = Math.min(minY, triangles[i + 1]);
        maxY = Math.max(maxY, triangles[i + 1]);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const out = [];
    for (let i = 0; i < triangles.length; i += 9) {
        for (let k = 0; k < 3; k += 1) {
            const x = triangles[i + (k * 3)];
            const y = triangles[i + (k * 3) + 1];
            const z = triangles[i + (k * 3) + 2];
            out.push(x - cx, -z, y - cy);
        }
    }
    return out;
}

export {
    solidFromCommands,
    sceneTriangles,
    stlBuffer
};
