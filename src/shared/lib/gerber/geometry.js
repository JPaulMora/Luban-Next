import * as ClipperLib from '../clipper/clipper';
import {
    polyDiff,
    polyOffset,
    recursivePolyUnion,
} from '../clipper/cLipper-adapter';

// Gerber regions and overlapping copper use the non-zero winding rule.
// Even-odd would punch a hole where a teardrop overlaps the track it joins.
const NON_ZERO = ClipperLib.PolyFillType.pftNonZero;

const ROUND_PRECISION = 0.02;

const signedArea = (ring) => {
    let area = 0;
    const count = ring.length;
    for (let i = 0; i < count; i += 1) {
        const j = (i + 1) % count;
        area += (ring[i][0] * ring[j][1]) - (ring[j][0] * ring[i][1]);
    }
    return area / 2;
};

const cleanRing = (ring) => {
    const cleaned = [];
    ring.forEach((point) => {
        const last = cleaned[cleaned.length - 1];
        if (!last || Math.abs(last[0] - point[0]) > 1e-6 || Math.abs(last[1] - point[1]) > 1e-6) {
            cleaned.push(point);
        }
    });
    if (cleaned.length > 1) {
        const first = cleaned[0];
        const last = cleaned[cleaned.length - 1];
        if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
            cleaned.pop();
        }
    }
    return cleaned;
};

const withOrientation = (ring, ccw) => {
    const cleaned = cleanRing(ring);
    if (cleaned.length < 3) {
        return null;
    }
    const positive = signedArea(cleaned) > 0;
    if (positive !== ccw) {
        cleaned.reverse();
    }
    return cleaned;
};

const asPaths = (rings) => {
    const paths = [];
    rings.forEach((ring) => {
        const cleaned = cleanRing(ring);
        if (cleaned.length >= 3) {
            paths.push(cleaned);
        }
    });
    return paths;
};

const offsetPaths = (paths, delta, open = false) => {
    const minPoints = open ? 2 : 3;
    const usable = (paths || [])
        .map((ring) => cleanRing(ring))
        .filter((ring) => ring.length >= minPoints);
    if (!usable.length || !Number.isFinite(delta) || Math.abs(delta) < 1e-9) {
        return open ? [] : usable;
    }
    const endType = open
        ? ClipperLib.EndType.etOpenRound
        : ClipperLib.EndType.etClosedPolygon;
    const result = polyOffset(
        usable,
        delta,
        ClipperLib.JoinType.jtRound,
        endType,
        2,
        ROUND_PRECISION
    );
    return asPaths(result || []);
};

const unionPaths = (pathss) => {
    const usable = pathss.filter((paths) => paths && paths.length && paths[0] && paths[0].length >= 3);
    if (!usable.length) {
        return [];
    }
    if (usable.length === 1) {
        return usable[0];
    }
    return asPaths(recursivePolyUnion(usable, NON_ZERO) || []);
};

const differencePaths = (subject, clip) => {
    if (!subject || !subject.length) {
        return [];
    }
    if (!clip || !clip.length) {
        return subject;
    }
    return asPaths(polyDiff(subject, clip, NON_ZERO) || []);
};

const pathsArea = (paths) => {
    let area = 0;
    (paths || []).forEach((ring) => {
        area += signedArea(ring);
    });
    return Math.abs(area);
};

// Swept aperture: Minkowski sum of a shape centered on the origin with the stroke.
// Circle strokes use offsetPaths instead; this is for rectangles, obrounds, and polygons.
const sweepShape = (centerline, shape) => {
    const scale = 1e6;
    const pattern = shape.map(([x, y]) => ({
        X: Math.round(x * scale),
        Y: Math.round(y * scale),
    }));
    const path = centerline.map(([x, y]) => ({
        X: Math.round(x * scale),
        Y: Math.round(y * scale),
    }));
    if (pattern.length < 3 || path.length < 2) {
        return [];
    }
    const closed = path.length > 2
        && path[0].X === path[path.length - 1].X
        && path[0].Y === path[path.length - 1].Y;
    const summed = ClipperLib.Clipper.MinkowskiSum(pattern, path, closed);
    return asPaths((summed || []).map((ring) => ring.map((point) => [point.X / scale, point.Y / scale])));
};

const circlePoints = (cx, cy, radius, steps = 32) => {
    const points = [];
    for (let i = 0; i < steps; i += 1) {
        const angle = (2 * Math.PI * i) / steps;
        points.push([cx + (radius * Math.cos(angle)), cy + (radius * Math.sin(angle))]);
    }
    return points;
};

const rectanglePoints = (cx, cy, width, height) => ([
    [cx - (width / 2), cy - (height / 2)],
    [cx + (width / 2), cy - (height / 2)],
    [cx + (width / 2), cy + (height / 2)],
    [cx - (width / 2), cy + (height / 2)],
]);

const obroundPoints = (cx, cy, width, height) => {
    const steps = 16;
    const points = [];
    if (width >= height) {
        const radius = height / 2;
        const dx = (width - height) / 2;
        for (let i = 0; i <= steps; i += 1) {
            const angle = (-Math.PI / 2) + ((Math.PI * i) / steps);
            points.push([cx + dx + (radius * Math.cos(angle)), cy + (radius * Math.sin(angle))]);
        }
        for (let i = 0; i <= steps; i += 1) {
            const angle = (Math.PI / 2) + ((Math.PI * i) / steps);
            points.push([cx - dx + (radius * Math.cos(angle)), cy + (radius * Math.sin(angle))]);
        }
    } else {
        const radius = width / 2;
        const dy = (height - width) / 2;
        for (let i = 0; i <= steps; i += 1) {
            const angle = (Math.PI * i) / steps;
            points.push([cx + (radius * Math.cos(angle)), cy - dy + (radius * Math.sin(angle))]);
        }
        for (let i = 0; i <= steps; i += 1) {
            const angle = Math.PI + ((Math.PI * i) / steps);
            points.push([cx + (radius * Math.cos(angle)), cy + dy + (radius * Math.sin(angle))]);
        }
    }
    return points;
};

const regularPolygon = (cx, cy, diameter, vertices, rotationDeg = 0) => {
    const points = [];
    const rotation = (rotationDeg * Math.PI) / 180;
    for (let i = 0; i < vertices; i += 1) {
        const angle = rotation + ((2 * Math.PI * i) / vertices);
        points.push([
            cx + ((diameter / 2) * Math.cos(angle)),
            cy + ((diameter / 2) * Math.sin(angle)),
        ]);
    }
    return points;
};

const reverseRing = (ring) => ring.slice().reverse();

// FlatCAM reverses the first isolation pass so a clockwise spindle climbs with
// copper on the right (conventional milling). Holes keep Clipper's direction.
const conventionalRings = (paths) => paths.map((ring) => (
    signedArea(ring) > 0 ? reverseRing(ring) : ring.slice()
));

const pointInPaths = (point, paths) => {
    let inside = false;
    (paths || []).forEach((ring) => {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
            const yi = ring[i][1];
            const yj = ring[j][1];
            const xi = ring[i][0];
            const xj = ring[j][0];
            const crosses = ((yi > point[1]) !== (yj > point[1]))
                && (point[0] < (((xj - xi) * (point[1] - yi)) / (yj - yi)) + xi);
            if (crosses) {
                inside = !inside;
            }
        }
    });
    return inside;
};

const ringBounds = (ring) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    ring.forEach((point) => {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
    });
    return { minX, minY, maxX, maxY };
};

const axisGap = (minA, maxA, minB, maxB) => {
    if (minA > maxB) {
        return minA - maxB;
    }
    if (minB > maxA) {
        return minB - maxA;
    }
    return 0;
};

const boundsSeparation = (a, b) => Math.hypot(
    axisGap(a.minX, a.maxX, b.minX, b.maxX),
    axisGap(a.minY, a.maxY, b.minY, b.maxY)
);

const distanceToPaths = (point, paths) => {
    let best = Infinity;
    (paths || []).forEach((ring) => {
        const count = ring.length;
        for (let i = 0; i < count; i += 1) {
            const a = ring[i];
            const b = ring[(i + 1) % count];
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const len2 = (dx * dx) + (dy * dy);
            let t = 0;
            if (len2 > 0) {
                t = (((point[0] - a[0]) * dx) + ((point[1] - a[1]) * dy)) / len2;
                t = Math.max(0, Math.min(1, t));
            }
            const px = a[0] + (t * dx);
            const py = a[1] + (t * dy);
            const dist = Math.hypot(point[0] - px, point[1] - py);
            if (dist < best) {
                best = dist;
            }
        }
    });
    return best;
};

// Smallest gap between distinct copper rings. Touching edges are ignored.
const CONTACT = 0.05;

const finestGap = (paths) => {
    const rings = (paths || []).filter((ring) => ring && ring.length >= 3);
    const boxes = rings.map(ringBounds);
    let best = Infinity;
    rings.forEach((ring, index) => {
        const near = [];
        boxes.forEach((box, other) => {
            if (other !== index && boundsSeparation(boxes[index], box) < best) {
                near.push(rings[other]);
            }
        });
        if (!near.length) {
            return;
        }
        ring.forEach((point) => {
            const gap = distanceToPaths(point, near);
            if (gap >= CONTACT && gap < best) {
                best = gap;
            }
        });
    });
    if (!Number.isFinite(best)) {
        return null;
    }
    return Math.round(best * 1000) / 1000;
};

export {
    signedArea,
    withOrientation,
    offsetPaths,
    unionPaths,
    differencePaths,
    pathsArea,
    sweepShape,
    circlePoints,
    rectanglePoints,
    obroundPoints,
    regularPolygon,
    conventionalRings,
    pointInPaths,
    distanceToPaths,
    finestGap,
};
