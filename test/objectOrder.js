import { test } from 'tape';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true
    }
});
const { nextStackedTarget } = require('../src/app/lib/object-order');

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
