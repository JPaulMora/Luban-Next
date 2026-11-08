/**
 * Rectangle span a job can use after installed module offsets.
 *
 * Same rule as the print work range: each active module shifts both
 * ends by its workRangeOffset, then the low end is clamped to 0.
 * The returned size is the length of what remains. Offsets from every
 * active module are added. A positive offset slides the range without
 * shrinking it. A negative offset shortens it from the far end.
 */

export function reachableRectangleSize(size, modules, activeModuleIds) {
    let minX = 0;
    let minY = 0;
    let maxX = Number(size && size.x) || 0;
    let maxY = Number(size && size.y) || 0;
    const active = activeModuleIds || [];

    for (const machineModule of modules || []) {
        if (!machineModule || active.indexOf(machineModule.identifier) < 0) {
            continue;
        }
        const offset = machineModule.workRangeOffset;
        if (!offset) {
            continue;
        }
        const dx = Number(offset[0]) || 0;
        const dy = Number(offset[1]) || 0;
        minX += dx;
        maxX += dx;
        minY += dy;
        maxY += dy;
    }

    minX = Math.max(minX, 0);
    minY = Math.max(minY, 0);

    return {
        x: Math.max(0, maxX - minX),
        y: Math.max(0, maxY - minY),
    };
}

/**
 * Cap one workpiece axis at the reachable span.
 * A missing span (0) leaves the value alone so a job is not zeroed
 * before the machine definition has loaded.
 */
export function limitToReach(value, max) {
    if (!(max > 0)) {
        return value;
    }
    return Math.min(value, max);
}
