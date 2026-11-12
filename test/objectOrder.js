import { test } from 'tape';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true
    }
});
const { moveToInsertPosition, nextStackedTarget } = require('../src/app/lib/object-order');

test('moveToInsertPosition moves one item before the given position', (t) => {
    const list = ['a', 'b', 'c', 'd'];
    t.deepEqual(moveToInsertPosition(list, 0, 2), ['b', 'a', 'c', 'd'], 'first item down by one');
    t.deepEqual(moveToInsertPosition(list, 3, 0), ['d', 'a', 'b', 'c'], 'last item to the top');
    t.deepEqual(moveToInsertPosition(list, 1, 4), ['a', 'c', 'd', 'b'], 'item to the end');
    t.deepEqual(moveToInsertPosition(list, 2, 1), ['a', 'c', 'b', 'd'], 'item up by one');
    t.deepEqual(list, ['a', 'b', 'c', 'd'], 'input list unchanged');
    t.end();
});

test('moveToInsertPosition keeps the list when nothing moves', (t) => {
    const list = ['a', 'b', 'c'];
    t.equal(moveToInsertPosition(list, 1, 1), list, 'drop on its own place');
    t.equal(moveToInsertPosition(list, 1, 2), list, 'drop right below itself');
    t.equal(moveToInsertPosition(list, -1, 0), list, 'index below range');
    t.equal(moveToInsertPosition(list, 3, 0), list, 'index above range');
    t.deepEqual(moveToInsertPosition(list, 0, 99), ['b', 'c', 'a'], 'position past the end clamps to the end');
    t.end();
});

test('nextStackedTarget walks down the stack under the pointer', (t) => {
    const stack = ['top', 'middle', 'bottom'];
    t.equal(nextStackedTarget([], []), null, 'nothing under the pointer');
    t.equal(nextStackedTarget(['only'], []), 'only', 'a single object is picked');
    t.equal(nextStackedTarget(['only'], ['only']), 'only', 'a single selected object stays');
    t.equal(nextStackedTarget(stack, []), 'middle', 'without selection: the one below the top');
    t.equal(nextStackedTarget(stack, ['top']), 'middle', 'top selected: one below');
    t.equal(nextStackedTarget(stack, ['middle']), 'bottom', 'middle selected: one below');
    t.equal(nextStackedTarget(stack, ['bottom']), 'top', 'bottom selected: back to the top');
    t.equal(nextStackedTarget(stack, ['elsewhere']), 'middle', 'selection elsewhere: the one below the top');
    t.equal(nextStackedTarget(stack, ['top', 'bottom']), 'middle', 'several selected: the one below the top');
    t.end();
});
