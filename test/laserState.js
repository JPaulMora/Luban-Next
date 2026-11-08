import { test } from 'tape';

import { deriveHeadStatus } from '../src/server/services/machine/channels/laserState';

test('deriveHeadStatus follows laser power and stays unknown when power is missing', (t) => {
    t.equal(deriveHeadStatus(undefined), undefined);
    t.equal(deriveHeadStatus(null), undefined);
    t.equal(deriveHeadStatus(0), false);
    t.equal(deriveHeadStatus(1), true);
    t.equal(deriveHeadStatus('40'), true);
    t.end();
});
