import { test } from 'tape';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
    },
});

const { vbitPocketDiameter, vbitReliefTipDiameter } = require('../src/server/lib/cnc/vbitPocketDiameter');

test('vbit pocket uses the cone width at the cut depth', (t) => {
    const carving = {
        toolType: 'vbit',
        toolDiameter: 3.175,
        toolAngle: 30,
        definitionName: 'Carving V-bit',
    };
    const at2mm = vbitPocketDiameter(carving, 2);
    const expected = 2 * 2 * Math.tan((30 / 2) * Math.PI / 180);
    t.ok(Math.abs(at2mm - expected) < 1e-9, `width=${at2mm}`);
    t.ok(at2mm < 3.175);
    t.equal(vbitPocketDiameter(carving, 10), null);
    t.end();
});

test('vbit relief uses the tip when the stored diameter is the shank', (t) => {
    const carving = {
        toolType: 'vbit',
        toolDiameter: 3.175,
        toolAngle: 30,
        toolShaftDiameter: 3.175,
        definitionName: 'Carving V-bit',
    };
    t.equal(vbitReliefTipDiameter(carving), 0.2);
    t.equal(vbitReliefTipDiameter({
        ...carving,
        toolDiameter: 0.2,
    }), null);
    t.equal(vbitReliefTipDiameter({
        toolType: 'flat',
        toolDiameter: 3.175,
        toolAngle: 180,
        toolShaftDiameter: 3.175,
        definitionName: 'Flat End Mill',
    }), null);
    t.end();
});

test('vbit pocket leaves a tip-sized diameter and flat mills alone', (t) => {
    t.equal(vbitPocketDiameter({
        toolType: 'vbit',
        toolDiameter: 0.2,
        toolAngle: 30,
    }, 2), null);
    t.equal(vbitPocketDiameter({
        toolType: 'flat',
        toolDiameter: 3.175,
        toolAngle: 180,
        definitionName: 'Flat End Mill 3.175',
    }, 2), null);
    t.end();
});
