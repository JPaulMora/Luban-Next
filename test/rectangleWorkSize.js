import { test } from 'tape';

import { limitToReach, reachableRectangleSize } from '../src/app/machines/rectangleWorkSize';

const a350 = { x: 320, y: 350 };
const quickSwap = {
    identifier: 'snapmaker-2.0-quick-swap-module',
    workRangeOffset: [0, -15, -15],
};
const bracing = {
    identifier: 'snapmaker-2.0-bracing-kit-module',
    workRangeOffset: [0, -12, -6],
};

test('reachable rectangle size keeps the full bed with no modules', (t) => {
    t.deepEqual(reachableRectangleSize(a350, [quickSwap, bracing], []), a350);
    t.deepEqual(reachableRectangleSize(a350, undefined, undefined), a350);
    t.end();
});

test('reachable rectangle size shortens Y for one installed kit', (t) => {
    t.deepEqual(
        reachableRectangleSize(a350, [quickSwap, bracing], [quickSwap.identifier]),
        { x: 320, y: 335 }
    );
    t.deepEqual(
        reachableRectangleSize(a350, [quickSwap, bracing], [bracing.identifier]),
        { x: 320, y: 338 }
    );
    t.end();
});

test('reachable rectangle size adds every active module offset', (t) => {
    t.deepEqual(
        reachableRectangleSize(a350, [quickSwap, bracing], [
            quickSwap.identifier,
            bracing.identifier,
        ]),
        { x: 320, y: 323 }
    );
    t.end();
});

test('reachable rectangle size keeps the span when an offset only shifts it', (t) => {
    const shifted = {
        identifier: 'shift',
        workRangeOffset: [10, 0, 0],
    };
    t.deepEqual(
        reachableRectangleSize(a350, [shifted], [shifted.identifier]),
        a350
    );
    t.end();
});

test('limitToReach caps an axis and leaves it when the span is unknown', (t) => {
    t.equal(limitToReach(350, 335), 335);
    t.equal(limitToReach(300, 335), 300);
    t.equal(limitToReach(350, 0), 350);
    t.end();
});
