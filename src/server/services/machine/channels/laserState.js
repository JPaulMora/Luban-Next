/**
 * Laser on/off from the numeric power reported by HTTP status.
 *
 * /api/v1/status has laserPower and no boolean. Undefined means the
 * poll did not say, so the caller should keep the last value.
 *
 * @param {number|undefined|null} laserPower
 * @returns {boolean|undefined}
 */
export function deriveHeadStatus(laserPower) {
    if (laserPower === undefined || laserPower === null) {
        return undefined;
    }
    return Number(laserPower) > 0;
}
