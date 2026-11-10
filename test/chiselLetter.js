const { test } = require('tape');

const burin = require('../packages/burin');

function rectangle(x, y, width, height) {
    return [[
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height]
    ]];
}

function edgeCounts(mesh) {
    const counts = new Map();
    const { indices } = mesh;
    for (let i = 0; i < indices.length; i += 3) {
        const tri = [indices[i], indices[i + 1], indices[i + 2]];
        for (let k = 0; k < 3; k += 1) {
            const a = tri[k];
            const b = tri[(k + 1) % 3];
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        }
    }
    return counts;
}

function signedVolume(mesh) {
    const { positions, indices } = mesh;
    let volume = 0;
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 3;
        const b = indices[i + 1] * 3;
        const c = indices[i + 2] * 3;
        volume += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]);
        volume += positions[a + 1] * (positions[b + 2] * positions[c] - positions[b] * positions[c + 2]);
        volume += positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
    }
    return volume / 6;
}

function deepest(mesh) {
    const { positions } = mesh;
    let z = 0;
    const points = [];
    for (let i = 2; i < positions.length; i += 3) {
        if (positions[i] < z - 1e-6) {
            z = positions[i];
            points.length = 0;
        }
        if (Math.abs(positions[i] - z) <= 1e-4) {
            points.push([positions[i - 2], positions[i - 1]]);
        }
    }
    const center = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
    return {
        z,
        x: center[0] / points.length,
        y: center[1] / points.length
    };
}

test('a wide stroke is a closed solid that bottoms at the target depth', (t) => {
    const mesh = burin.chiselContours(rectangle(0, 0, 20, 8), {
        steepAngle: 70,
        shallowAngle: 28,
        targetDepth: 2,
        pitch: 0.5
    });
    t.ok(mesh, 'mesh exists');
    const counts = edgeCounts(mesh);
    const open = Array.from(counts.values()).filter((count) => count !== 2);
    t.equal(open.length, 0, 'every edge is shared by two faces');
    t.ok(signedVolume(mesh) > 0, 'volume faces outward');

    const low = deepest(mesh);
    t.ok(Math.abs(low.z + 2) < 0.05, 'the floor is the target depth');
    t.ok(low.x < 10, 'the floor sits toward the steep side');
    t.end();
});

test('a narrow stroke meets before the target depth', (t) => {
    const mesh = burin.chiselContours(rectangle(0, 0, 1, 12), {
        steepAngle: 70,
        shallowAngle: 28,
        targetDepth: 2,
        pitch: 0.15
    });
    const low = deepest(mesh);
    t.ok(low.z < -0.05, 'the stroke is cut');
    t.ok(low.z > -2, 'the cut stays above the target depth');
    t.end();
});

function flatVolume(flat) {
    let volume = 0;
    for (let i = 0; i < flat.length; i += 9) {
        const ax = flat[i];
        const ay = flat[i + 1];
        const az = flat[i + 2];
        const bx = flat[i + 3];
        const by = flat[i + 4];
        const bz = flat[i + 5];
        const cx = flat[i + 6];
        const cy = flat[i + 7];
        const cz = flat[i + 8];
        volume += ax * (by * cz - bz * cy);
        volume += ay * (bz * cx - bx * cz);
        volume += az * (bx * cy - by * cx);
    }
    return volume / 6;
}

test('a slanted outline stays a closed solid in the CNC view', (t) => {
    const ring = [];
    for (let i = 0; i < 7; i += 1) {
        const angle = (i / 7) * Math.PI * 2;
        ring.push([Math.cos(angle) * 12, Math.sin(angle) * 8]);
    }
    const mesh = burin.chiselContours([ring], {
        steepAngle: 70,
        shallowAngle: 28,
        targetDepth: 2,
        pitch: 0.45
    });
    const counts = edgeCounts(mesh);
    const open = Array.from(counts.values()).filter((count) => count !== 2);
    t.equal(open.length, 0, 'every edge is shared by two faces');
    t.ok(signedVolume(mesh) > 0, 'volume faces outward');

    const scene = burin.sceneTriangles(mesh, { x: 0, y: 0 });
    let minY = 0;
    let maxY = 0;
    for (let i = 1; i < scene.length; i += 3) {
        minY = Math.min(minY, scene[i]);
        maxY = Math.max(maxY, scene[i]);
    }
    t.ok(flatVolume(scene) > 0, 'the CNC view keeps outward faces');
    t.ok(maxY <= 1e-6, 'the surface sits on the stock');
    t.ok(minY < -0.2, 'the groove points into the stock');
    t.end();
});

test('a hole stays open', (t) => {
    const outer = rectangle(0, 0, 12, 12)[0];
    const hole = [
        [4, 4],
        [4, 8],
        [8, 8],
        [8, 4]
    ];
    const mesh = burin.chiselContours([outer, hole], {
        steepAngle: 70,
        shallowAngle: 28,
        targetDepth: 2,
        pitch: 0.4
    });
    const { positions } = mesh;
    let cutInHole = 0;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        if (x > 4.8 && x < 7.2 && y > 4.8 && y < 7.2 && z < -0.05) {
            cutInHole += 1;
        }
    }
    t.equal(cutInHole, 0);
    const counts = edgeCounts(mesh);
    const open = Array.from(counts.values()).filter((count) => count !== 2);
    t.equal(open.length, 0, 'the ring is closed');
    t.end();
});
