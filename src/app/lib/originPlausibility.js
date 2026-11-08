/**
 * Whether Go To Work Origin should ask before descending.
 *
 * The saved origin survives a tool or stock change, so Z0 can sit
 * below the current surface.
 *
 * @param {{ currentZ: number, targetZ: number, margin?: number }} move
 * @returns {boolean}
 */
export function originMoveNeedsConfirm(move) {
    if (!move || !Number.isFinite(move.currentZ) || !Number.isFinite(move.targetZ)) {
        return false;
    }
    const margin = Number.isFinite(move.margin) ? move.margin : 1;
    return move.targetZ < move.currentZ - margin;
}
