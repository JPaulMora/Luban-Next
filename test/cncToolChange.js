import { test } from 'tape';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
    },
});

const {
    cncToolsDiffer,
    resolveToolChangeZOffset,
    buildCncToolChangeLines,
} = require('../src/shared/lib/cncToolChange');

const carving = {
    definitionId: 'tool.default_CVbit',
    definitionName: 'Carving V-bit',
    toolType: 'vbit',
    toolDiameter: 3.175,
    toolAngle: 30,
    toolShaftDiameter: 3.175,
};

const flat = {
    definitionId: 'tool.default_FEM1.5',
    definitionName: 'Flat End Mill 1.5',
    toolType: 'flat',
    toolDiameter: 1.5,
    toolAngle: 180,
    toolShaftDiameter: 1.5,
};

test('same tool emits nothing', (t) => {
    t.equal(cncToolsDiffer(carving, { ...carving }), false);
    t.equal(cncToolsDiffer({}, {}), false);
    t.equal(cncToolsDiffer(null, undefined), false);
    t.deepEqual(buildCncToolChangeLines(
        { toolParams: carving, gcodeConfig: { jogSpeed: 1500 } },
        { toolParams: { ...carving }, gcodeConfig: { jogSpeed: 1200 } }
    ), []);
    t.end();
});

test('missing offset is zero and still pauses', (t) => {
    t.equal(resolveToolChangeZOffset(undefined), 0);
    t.equal(resolveToolChangeZOffset({}), 0);
    t.equal(resolveToolChangeZOffset({ toolChangeZOffset: Number.NaN }), 0);

    const lines = buildCncToolChangeLines(
        { toolParams: carving, gcodeConfig: { jogSpeed: 1500 } },
        { toolParams: flat }
    );
    t.deepEqual(lines, [
        '; Tool change: Carving V-bit -> Flat End Mill 1.5',
        '; Z offset 0 mm. Positive means the new tool is longer.',
        'M600',
        'G0 X0 Y0 F1500',
        'G1 Z0 F100',
        'M600',
        'G92 Z0',
    ]);
    t.equal(lines.some((line) => line.indexOf('M5') === 0), false);
    t.equal(lines.some((line) => /^G0 Z/.test(line)), false);
    t.end();
});

test('offset 2, 0, and -1 emit the pause block', (t) => {
    const previous = { toolParams: carving, gcodeConfig: { jogSpeed: 1500 } };

    t.deepEqual(buildCncToolChangeLines(previous, {
        toolParams: { ...flat, toolChangeZOffset: 2 },
    }), [
        '; Tool change: Carving V-bit -> Flat End Mill 1.5',
        '; Z offset 2 mm. Positive means the new tool is longer.',
        'M600',
        'G0 X0 Y0 F1500',
        'G1 Z2 F100',
        'M600',
        'G92 Z0',
    ]);

    t.deepEqual(buildCncToolChangeLines(previous, {
        toolParams: { ...flat, toolChangeZOffset: 0 },
    }), [
        '; Tool change: Carving V-bit -> Flat End Mill 1.5',
        '; Z offset 0 mm. Positive means the new tool is longer.',
        'M600',
        'G0 X0 Y0 F1500',
        'G1 Z0 F100',
        'M600',
        'G92 Z0',
    ]);

    t.deepEqual(buildCncToolChangeLines(previous, {
        toolParams: { ...flat, toolChangeZOffset: -1 },
    }), [
        '; Tool change: Carving V-bit -> Flat End Mill 1.5',
        '; Z offset -1 mm. Positive means the new tool is longer.',
        'M600',
        'G0 X0 Y0 F1500',
        'G1 Z-1 F100',
        'M600',
        'G92 Z0',
    ]);
    t.end();
});

test('rotary tool change is refused', (t) => {
    t.throws(
        () => buildCncToolChangeLines(
            { toolParams: carving, materials: { isRotate: true } },
            { toolParams: flat }
        ),
        /rotary/i
    );
    t.throws(
        () => buildCncToolChangeLines(
            { toolParams: carving },
            { toolParams: flat, materials: { isRotate: true } }
        ),
        /rotary/i
    );
    t.end();
});
