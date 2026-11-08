/**
 * Two moves to the work origin so Z does not travel with X and Y.
 *
 * One G0 X0 Y0 B0 Z0 interpolates every axis at once, so the head can
 * descend diagonally into the bed. Above the origin, travel first and
 * drop Z last. At or below it, raise Z first, then travel.
 *
 * @param {{ z: number }} current work-coordinate position
 * @param {number|string} feed mm/min
 * @returns {string[]}
 */
export function sequenceGoToOrigin(current, feed) {
    const xy = `G0 X0 Y0 B0 F${feed}`;
    const z = `G0 Z0 F${feed}`;
    return current && Number(current.z) > 0 ? [xy, z] : [z, xy];
}
