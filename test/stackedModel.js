import fs from 'fs';
import os from 'os';
import path from 'path';
import { test } from 'tape';
import {
    defaultTiltAxis,
    layerIsKept,
    limitsForUpAxis,
    normalizeStackSettings,
    projectedExtent,
    sliceLayerCount,
    stackFrame,
    upAxisCoordinate
} from '../src/shared/lib/stackedModel';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
        jsx: 'react'
    }
});
const STLToSvgStack = require('../src/server/lib/MeshProcess/STLToSvgStack').default;

const previousTmpdir = process.env.Tmpdir;
const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'luban-stack-'));
process.env.Tmpdir = tmpdir;

function triangle(a, b, c) {
    return `  facet normal 0 0 0
    outer loop
      vertex ${a.join(' ')}
      vertex ${b.join(' ')}
      vertex ${c.join(' ')}
    endloop
  endfacet
`;
}

function boxStl(sx, sy, sz) {
    const v = [
        [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
        [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz]
    ];
    const faces = [
        [0, 2, 1], [0, 3, 2],
        [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4],
        [3, 6, 2], [3, 7, 6],
        [0, 4, 7], [0, 7, 3],
        [1, 2, 6], [1, 6, 5]
    ];
    return `solid box\n${faces.map(([i, j, k]) => triangle(v[i], v[j], v[k])).join('')}endsolid box\n`;
}

function looseBaseStl(sx, sy, sz) {
    const gap = 0.001;
    const v = [
        [0, 0, 0], [sx, 0, 0], [sx, sy, 0], [0, sy, 0],
        [0, 0, sz], [sx, 0, sz], [sx, sy, sz], [0, sy, sz],
        [0, 0, gap], [sx, 0, gap], [sx, sy, gap], [0, sy, gap]
    ];
    const faces = [
        [8, 10, 9], [8, 11, 10],
        [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4],
        [3, 6, 2], [3, 7, 6],
        [0, 4, 7], [0, 7, 3],
        [1, 2, 6], [1, 6, 5]
    ];
    return `solid box\n${faces.map(([i, j, k]) => triangle(v[i], v[j], v[k])).join('')}endsolid box\n`;
}

function polygonArea(layer) {
    let area = 0;
    layer.polygonsPart.forEach((polygon) => {
        const points = polygon.path;
        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            area += (a.x * b.y) - (b.x * a.y);
        }
    });
    return Math.abs(area) / 2;
}

function cutBox(materials) {
    const uploadName = `box-${Date.now()}-${Math.random().toString(16).slice(2)}.stl`;
    fs.writeFileSync(path.join(tmpdir, uploadName), boxStl(10, 16, 8));
    const stack = new STLToSvgStack({
        uploadName,
        originalName: 'box.stl',
        scale: 1,
        materials: {
            width: 300,
            height: 300,
            thickness: 2,
            ...materials
        }
    });
    const svgFiles = stack.toSVGStackFiles();
    const stlFile = stack.toSVGStackSTL();
    return { stack, svgFiles, stlFile, uploadName };
}

function removeOutputs(uploadName, svgFiles, stlFile) {
    const names = [uploadName];
    svgFiles.forEach((file) => names.push(file.filename));
    if (stlFile && stlFile.filename) {
        names.push(stlFile.filename);
    }
    names.forEach((name) => {
        const filePath = path.join(tmpdir, name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });
}

test('stacked model slice settings', (t) => {
    t.deepEqual(upAxisCoordinate('z'), { x: 'x', y: '-y', z: 'z' });
    t.deepEqual(upAxisCoordinate('nope'), upAxisCoordinate('z'));
    t.deepEqual(limitsForUpAxis('z', 100, 80, 500), { x: 100, y: 80, z: 500 });
    t.deepEqual(limitsForUpAxis('y', 100, 80, 500), { x: 100, y: 500, z: 80 });
    t.deepEqual(limitsForUpAxis('-y', 100, 80, 500), { x: 100, y: 500, z: 80 });
    t.deepEqual(limitsForUpAxis('x', 100, 80, 500), { x: 500, y: 80, z: 100 });
    t.deepEqual(limitsForUpAxis('-x', 100, 80, 500), { x: 500, y: 80, z: 100 });

    ['z', '-z', 'y', '-y', 'x', '-x'].forEach((axis) => {
        const coordinate = upAxisCoordinate(axis);
        const frame = stackFrame(axis, defaultTiltAxis(axis), 0);
        ['x', 'y', 'z'].forEach((output) => {
            const spec = coordinate[output];
            const sign = spec[0] === '-' ? -1 : 1;
            const name = spec.slice(-1);
            t.equal(frame[output].x, name === 'x' ? sign : 0, `${axis} ${output}.x`);
            t.equal(frame[output].y, name === 'y' ? sign : 0, `${axis} ${output}.y`);
            t.equal(frame[output].z, name === 'z' ? sign : 0, `${axis} ${output}.z`);
        });
        const limits = limitsForUpAxis(axis, 100, 80, 500);
        t.ok(Math.abs(projectedExtent(limits, frame.x) - 100) < 1e-9, `${axis} bed x`);
        t.ok(Math.abs(projectedExtent(limits, frame.y) - 80) < 1e-9, `${axis} bed y`);
        t.ok(Math.abs(projectedExtent(limits, frame.z) - 500) < 1e-9, `${axis} stack`);
    });

    const towardY = stackFrame('x', 'y', 45);
    t.ok(Math.abs(towardY.z.x - Math.SQRT1_2) < 1e-9);
    t.ok(Math.abs(towardY.z.y - Math.SQRT1_2) < 1e-9);
    t.ok(Math.abs(towardY.z.z) < 1e-9);
    const towardNegativeY = stackFrame('x', '-y', 45);
    t.ok(Math.abs(towardNegativeY.z.x - Math.SQRT1_2) < 1e-9);
    t.ok(Math.abs(towardNegativeY.z.y + Math.SQRT1_2) < 1e-9);
    const upright = stackFrame('x', 'y', 90);
    t.ok(Math.abs(upright.z.x) < 1e-12);
    t.ok(Math.abs(upright.z.y - 1) < 1e-12);
    t.ok(Math.abs(upright.z.z) < 1e-12);

    t.equal(normalizeStackSettings({ upAxis: 'x', tiltAxis: 'x', tiltAngle: 45 }).tiltAxis, 'y');
    t.equal(normalizeStackSettings({ upAxis: 'x', tiltAxis: '-y', tiltAngle: 45 }).tiltAxis, '-y');
    t.equal(normalizeStackSettings({ tiltAngle: 45 }).tiltAngle, 45);
    t.equal(normalizeStackSettings({ tiltAngle: 120 }).tiltAngle, 90);
    t.equal(normalizeStackSettings({ tiltAngle: -10 }).tiltAngle, 0);
    t.equal(normalizeStackSettings({}).tiltAxis, 'x');

    t.equal(sliceLayerCount(8, 2, 0), 4);
    t.equal(sliceLayerCount(8, 2, 4), 2);
    t.equal(sliceLayerCount(8, 2, 8), 0);
    t.equal(sliceLayerCount(10, 1.5, 0), 7);

    t.deepEqual([0, 1, 2, 3, 4, 5].map((index) => layerIsKept(index, 1, 1)), [
        true, false, true, false, true, false
    ]);
    t.deepEqual([0, 1, 2, 3, 4, 5].map((index) => layerIsKept(index, 2, 1)), [
        true, true, false, true, true, false
    ]);
    t.ok([0, 1, 2].every((index) => layerIsKept(index, 1, 0)));

    const zUp = cutBox({ upAxis: 'z' });
    t.equal(zUp.stlFile.layers, 4);
    t.deepEqual(zUp.stack.slicer.slicerLayers.map((layer) => layer.z), [1, 3, 5, 7]);
    t.ok(Math.abs(zUp.stlFile.width - 10) < 0.01);
    t.ok(Math.abs(zUp.stlFile.height - 16) < 0.01);
    t.ok(zUp.svgFiles.length > 0);
    t.ok(zUp.stack.slicer.slicerLayers.every((layer) => layer.polygonsPart.size() > 0));
    removeOutputs(zUp.uploadName, zUp.svgFiles, zUp.stlFile);

    const offset = cutBox({ upAxis: 'z', modelOffset: 4 });
    t.equal(offset.stlFile.layers, 2);
    t.deepEqual(offset.stack.slicer.slicerLayers.map((layer) => layer.z), [5, 7]);
    removeOutputs(offset.uploadName, offset.svgFiles, offset.stlFile);

    const skipped = cutBox({ upAxis: 'z', layersOn: 1, layersOff: 1 });
    t.equal(skipped.stlFile.layers, 2);
    t.deepEqual(skipped.stack.slicer.slicerLayers.map((layer) => layer.z), [1, 5]);
    t.deepEqual(skipped.stack.slicer.slicerLayers.map((layer) => layer.sourceIndex), [0, 2]);
    removeOutputs(skipped.uploadName, skipped.svgFiles, skipped.stlFile);

    const pattern = cutBox({ upAxis: 'z', layersOn: 2, layersOff: 1 });
    t.deepEqual(pattern.stack.slicer.slicerLayers.map((layer) => layer.z), [1, 3, 7]);
    removeOutputs(pattern.uploadName, pattern.svgFiles, pattern.stlFile);

    const yUp = cutBox({ upAxis: 'y' });
    t.equal(yUp.stlFile.layers, 8);
    t.ok(Math.abs(yUp.stlFile.width - 10) < 0.01);
    t.ok(Math.abs(yUp.stlFile.height - 8) < 0.01);
    removeOutputs(yUp.uploadName, yUp.svgFiles, yUp.stlFile);

    const xUp = cutBox({ upAxis: 'x' });
    t.equal(xUp.stlFile.layers, 5);
    t.ok(Math.abs(xUp.stlFile.width - 8) < 0.01);
    t.ok(Math.abs(xUp.stlFile.height - 16) < 0.01);
    xUp.stack.slicer.slicerLayers.forEach((layer) => {
        t.equal(layer.polygonsPart.size(), 1);
        t.ok(Math.abs(polygonArea(layer) - 128) < 0.1);
    });
    removeOutputs(xUp.uploadName, xUp.svgFiles, xUp.stlFile);

    // The base is a separate shell, so its edges are not welded to the walls.
    // Each sheet must still be the full cross-section, including that base.
    ['x', '-x', 'y', '-y', 'z', '-z'].forEach((upAxis) => {
        const uploadName = `loose-${upAxis}-${Date.now()}.stl`;
        fs.writeFileSync(path.join(tmpdir, uploadName), looseBaseStl(10, 16, 8));
        const stack = new STLToSvgStack({
            uploadName,
            originalName: 'loose.stl',
            scale: 1,
            materials: {
                width: 300,
                height: 300,
                thickness: 2,
                upAxis
            }
        });
        stack.slice();
        const fullArea = { y: 80, '-y': 80, z: 160, '-z': 160 }[upAxis] || 128;
        t.ok(stack.slicer.slicerLayers.length > 0, upAxis);
        stack.slicer.slicerLayers.forEach((layer) => {
            t.equal(layer.polygonsPart.size(), 1, `${upAxis} z=${layer.z}`);
            t.ok(Math.abs(polygonArea(layer) - fullArea) < 1, `${upAxis} z=${layer.z} area`);
        });
        fs.unlinkSync(path.join(tmpdir, uploadName));
    });

    const diagonalLength = (10 + 16) * Math.SQRT1_2;
    const diagonal = cutBox({ upAxis: 'x', tiltAxis: 'y', tiltAngle: 45 });
    t.equal(diagonal.stlFile.layers, sliceLayerCount(diagonalLength, 2, 0));
    t.ok(Math.abs(diagonal.stack.aabb.length.z - diagonalLength) < 0.05);
    t.ok(Math.abs(diagonal.stlFile.width - 8) < 0.05);
    t.ok(Math.abs(diagonal.stlFile.height - diagonalLength) < 0.05);
    diagonal.stack.slicer.slicerLayers.forEach((layer) => {
        t.equal(layer.polygonsPart.size(), 1, `tilt z=${layer.z}`);
        t.ok(polygonArea(layer) > 1, `tilt z=${layer.z} area`);
    });
    removeOutputs(diagonal.uploadName, diagonal.svgFiles, diagonal.stlFile);

    const down = cutBox({ upAxis: '-z' });
    t.equal(down.stlFile.layers, 4);
    t.ok(Math.abs(down.stlFile.width - 10) < 0.01);
    t.ok(Math.abs(down.stlFile.height - 16) < 0.01);
    removeOutputs(down.uploadName, down.svgFiles, down.stlFile);

    fs.rmdirSync(tmpdir);
    process.env.Tmpdir = previousTmpdir;
    t.end();
});
