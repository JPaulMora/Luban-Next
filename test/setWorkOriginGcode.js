import { test } from 'tape';

import { buildSetWorkOriginGcode, finiteAxis } from '../src/server/services/machine/setWorkOriginGcode';

test('finiteAxis keeps zero and drops an absent axis', (t) => {
    t.equal(finiteAxis(0), 0);
    t.equal(finiteAxis('0'), 0);
    t.equal(finiteAxis(null), null);
    t.equal(finiteAxis(undefined), null);
    t.equal(finiteAxis(''), null);
    t.end();
});

test('buildSetWorkOriginGcode includes axes at zero', (t) => {
    t.equal(buildSetWorkOriginGcode({ x: 0, y: 0, z: 12, b: null }), 'G92 X0 Y0 Z12');
    t.equal(buildSetWorkOriginGcode({ x: 10, y: 20 }), 'G92 X10 Y20');
    t.end();
});
