const path = require('path');
const test = require('tape');
const opentype = require('opentype.js');
const chisel = require('../src/server/lib/chisel');
const arialA = require('./fixtures/chisel-arial-a.json');

const FONT = path.join(__dirname, '../src/app/resources/fonts/Interstate-Regular-webfont.ttf');

function solid(text) {
    const font = opentype.loadSync(FONT);
    const capital = font.getPath('T', 0, 0, 1000).getBoundingBox();
    const scale = 40 / (capital.y2 - capital.y1);
    const glyphPath = font.getPath(text, 0, 0, 1000);
    return chisel.solidFromCommands(glyphPath.commands, scale, glyphPath.getBoundingBox());
}

function edgeKey(a, b) {
    const point = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
    const ka = point(a);
    const kb = point(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

function openEdges(triangles) {
    const counts = new Map();
    for (let i = 0; i < triangles.length; i += 9) {
        const points = [
            [triangles[i], triangles[i + 1], triangles[i + 2]],
            [triangles[i + 3], triangles[i + 4], triangles[i + 5]],
            [triangles[i + 6], triangles[i + 7], triangles[i + 8]]
        ];
        [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => {
            const key = edgeKey(points[a], points[b]);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
    }
    let open = 0;
    counts.forEach((count) => {
        if (count !== 2) {
            open += 1;
        }
    });
    return open;
}

function volume(triangles) {
    let sum = 0;
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
        sum += (ax * ((by * cz) - (bz * cy)))
            - (ay * ((bx * cz) - (bz * cx)))
            + (az * ((bx * cy) - (by * cx)));
    }
    return sum / 6;
}

test('a capital T is eight faces and a closed solid', (t) => {
    const result = solid('T');
    t.equal(result.faces.length, 8);
    t.equal(openEdges(result.triangles), 0);
    t.ok(volume(result.triangles) > 0);
    t.ok(result.thickness > 3 && result.thickness < 3.4);
    t.ok(result.thickness < result.height);
    t.end();
});

test('a capital O stays closed', (t) => {
    const result = solid('O');
    t.ok(result.faces.length > 100);
    t.equal(openEdges(result.triangles), 0);
    t.ok(volume(result.triangles) > 0);
    t.ok(result.thickness < result.height);
    t.end();
});

test('a dense double-story a stays a closed solid', (t) => {
    const result = chisel.solidFromCommands(arialA.commands, 1, arialA.box);
    t.ok(result);
    t.equal(openEdges(result.triangles), 0);
    t.ok(volume(result.triangles) > 0);
    t.ok(result.thickness > 0 && result.thickness < result.height);
    t.end();
});

test('the scene mesh keeps the flat face at Y=0', (t) => {
    const result = solid('T');
    const scene = chisel.sceneTriangles(result.triangles);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < scene.length; i += 3) {
        minX = Math.min(minX, scene[i]);
        maxX = Math.max(maxX, scene[i]);
        minY = Math.min(minY, scene[i + 1]);
        maxY = Math.max(maxY, scene[i + 1]);
        minZ = Math.min(minZ, scene[i + 2]);
        maxZ = Math.max(maxZ, scene[i + 2]);
    }
    t.ok(Math.abs(minY) < 1e-4);
    t.ok(maxY > 1);
    t.ok(Math.abs((minX + maxX) / 2) < 1e-4);
    t.ok(Math.abs((maxX - minX) - result.width) < 1e-3);
    t.ok(Math.abs((maxZ - minZ) - result.height) < 1e-3);
    t.ok(volume(scene) > 0);
    t.equal(openEdges(scene), 0);
    t.end();
});
