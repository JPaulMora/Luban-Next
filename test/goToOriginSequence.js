import { test } from 'tape';

import { sequenceGoToOrigin } from '../src/app/lib/goToOriginSequence';
import { originMoveNeedsConfirm } from '../src/app/lib/originPlausibility';

test('sequenceGoToOrigin travels before it drops, and raises before it travels', (t) => {
    const above = sequenceGoToOrigin({ z: 10 }, 1500);
    t.equal(above[0].indexOf('X0') >= 0, true);
    t.equal(above[1].indexOf('Z0') >= 0, true);
    t.equal(above[0].indexOf('Z0') >= 0, false);

    const below = sequenceGoToOrigin({ z: -2 }, 1500);
    t.equal(below[0].indexOf('Z0') >= 0, true);
    t.equal(below[1].indexOf('X0') >= 0, true);

    const level = sequenceGoToOrigin({ z: 0 }, 1500);
    t.equal(level[0].indexOf('Z0') >= 0, true);
    t.end();
});

test('originMoveNeedsConfirm asks only for a descent past the margin', (t) => {
    t.equal(originMoveNeedsConfirm({ currentZ: 10, targetZ: 0 }), true);
    t.equal(originMoveNeedsConfirm({ currentZ: 0.5, targetZ: 0 }), false);
    t.equal(originMoveNeedsConfirm({ currentZ: 0, targetZ: 0 }), false);
    t.equal(originMoveNeedsConfirm({ currentZ: Number.NaN, targetZ: 0 }), false);
    t.end();
});
