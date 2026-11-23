import fs from 'fs';
import path from 'path';
import { test } from 'tape';

import { cuttingDiameter, DEFAULT_VBIT, recommendedIsolationDepth } from '../src/shared/lib/gerber/cuttingWidth';
import {
    circlePoints,
    distanceToPaths,
    finestGap,
    pointInPaths,
    unionPaths,
} from '../src/shared/lib/gerber/geometry';
import { importGerber, isolateCopper } from '../src/shared/lib/gerber/isolate';
import { parseGerber } from '../src/shared/lib/gerber/parseGerber';

const square = (x, y, size) => ([
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
]);

test('carving V-bit width is the cone at the cut depth, capped by the 1/8 in shank', (t) => {
    const at2mm = cuttingDiameter(DEFAULT_VBIT, 2);
    const expected = 2 * 2 * Math.tan((30 / 2) * Math.PI / 180);
    t.ok(Math.abs(at2mm - expected) < 1e-9, `width=${at2mm}`);
    t.ok(at2mm < 3.175);
    t.equal(cuttingDiameter({
        toolType: 'flat',
        toolDiameter: 1.5,
        toolAngle: 180,
        definitionName: 'Flat End Mill',
    }, 2), 1.5);
    t.end();
});

test('isolation centerline is the middle of the removed band', (t) => {
    const copper = [square(0, 0, 10)];
    const diameter = 2;
    const isolated = isolateCopper(copper, diameter);
    const probe = [-diameter / 2, 5];
    t.ok(distanceToPaths(probe, isolated.centerlines) < 0.05, 'centerline sits one radius off the copper');
    t.ok(pointInPaths(probe, isolated.removal), 'that point is inside the removal area');
    t.notOk(pointInPaths([5, 5], isolated.removal), 'copper itself is not removed');
    t.notOk(pointInPaths([-4, 5], isolated.removal), 'the band stops at one tool diameter');
    t.notOk(isolated.narrow);
    t.end();
});

test('a teardrop overlapping a pad stays copper', (t) => {
    const pad = circlePoints(0, 0, 1);
    const drop = [
        [-0.2, 0.15],
        [1.6, 0.9],
        [1.6, -0.9],
        [-0.2, -0.15],
    ];
    const united = unionPaths([[pad], [drop]]);
    const overlap = [0.6, 0];
    t.ok(pointInPaths(overlap, united), 'the overlap is still copper');
    const isolated = isolateCopper(united, 1);
    const onCut = isolated.centerlines.some((ring) => distanceToPaths(overlap, [ring]) < 0.2);
    t.notOk(onCut, 'the toolpath does not cut through the overlap');
    t.end();
});

test('gaps narrower than the cutting width are reported', (t) => {
    const tight = [square(0, 0, 10), square(10.3, 0, 10)];
    const open = [square(0, 0, 10), square(15, 0, 10)];
    t.ok(isolateCopper(tight, 1).narrow);
    t.notOk(isolateCopper(open, 1).narrow);
    t.end();
});

test('the finest gap becomes a V-bit depth that still fits', (t) => {
    const gap = finestGap([square(0, 0, 10), square(10.35, 0, 10)]);
    t.ok(Math.abs(gap - 0.35) < 0.01, `gap=${gap}`);
    t.equal(recommendedIsolationDepth(DEFAULT_VBIT, gap), 0.6);
    t.equal(recommendedIsolationDepth({ ...DEFAULT_VBIT, toolAngle: 180, toolType: 'endmill', definitionName: 'Flat' }, gap), null);
    t.equal(finestGap([square(0, 0, 10)]), null);
    t.end();
});

test('a stroked track stays copper and absorbs an overlapping teardrop', (t) => {
    const gerber = [
        '%FSLAX36Y36*%',
        '%MOMM*%',
        '%ADD10C,1.000000*%',
        'D10*',
        'X0Y0D02*',
        'X10000000Y0D01*',
        'G36*',
        'X4000000Y-2000000D02*',
        'X4000000Y2000000D01*',
        'X8000000Y2000000D01*',
        'X8000000Y-2000000D01*',
        'X4000000Y-2000000D01*',
        'G37*',
        'M02*',
    ].join('\n');
    const parsed = parseGerber(gerber);
    t.equal(parsed.paths.length, 1, 'the teardrop joins the track');
    t.ok(pointInPaths([2, 0], parsed.paths), 'the plain track is copper');
    t.ok(pointInPaths([6, 0], parsed.paths), 'the overlap is copper');
    const isolated = isolateCopper(parsed.paths, 0.4);
    t.notOk(
        isolated.centerlines.some((ring) => distanceToPaths([6, 0], [ring]) < 0.15),
        'the toolpath does not cut through the teardrop'
    );
    t.end();
});

test('simple1.gbr becomes copper in millimetres and an isolation svg', (t) => {
    const file = path.join(__dirname, '../flatcam/tests/gerber_files/simple1.gbr');
    const text = fs.readFileSync(file, 'utf8');
    const parsed = parseGerber(text);
    t.ok(parsed.paths.length > 0);
    const imported = importGerber(text);
    t.ok(imported.width > 10 && imported.width < 30, `width=${imported.width}`);
    t.ok(imported.height > 8 && imported.height < 30, `height=${imported.height}`);
    t.ok(imported.svg.includes('fill-rule="nonzero"'));
    t.notOk((imported.warnings || []).some((message) => message.includes('cutting width')));
    t.end();
});
