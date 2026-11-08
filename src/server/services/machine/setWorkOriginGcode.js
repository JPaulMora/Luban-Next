/**
 * Axis value for a work-origin command.
 * 0 is a real position. null, undefined, and '' mean the axis is absent.
 *
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
export function finiteAxis(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * G92 for every finite axis, including axes set to 0.
 * Truthiness checks dropped X0/Y0/Z0 and left the previous origin.
 *
 * @param {{x?: number, y?: number, z?: number, b?: number}} axes
 * @returns {string}
 */
export function buildSetWorkOriginGcode(axes) {
    const parts = [];
    ['x', 'y', 'z', 'b'].forEach((key) => {
        const value = finiteAxis(axes && axes[key]);
        if (value !== null) {
            parts.push(`${key.toUpperCase()}${value}`);
        }
    });
    return ['G92', ...parts].join(' ');
}
