// Stock Carving V-bit: 1/8 in shank, 30 degree included angle.
// `diameter` in the tool profile is the shank, not the width at cutting depth.
const DEFAULT_VBIT = {
    toolType: 'vbit',
    toolDiameter: 3.175,
    toolAngle: 30,
    toolShaftDiameter: 3.175,
    definitionName: 'Carving V-bit',
};

// Same default target depth as a CNC vector toolpath.
const DEFAULT_ISOLATION_DEPTH = 2;

const isVbit = (tool) => {
    const hint = `${tool.toolType || ''} ${tool.definitionName || ''}`.toLowerCase();
    if (hint.includes('vbit') || hint.includes('v-bit') || hint.includes('v bit')) {
        return true;
    }
    const angle = Number(tool.toolAngle);
    return angle > 0 && angle < 180;
};

/**
 * Width of the cut at `depth`. A V-bit is the cone width, and never wider
 * than the shank. A flat mill (angle 180) is its diameter.
 * @param {{
 *   toolType?: string,
 *   toolDiameter?: number,
 *   toolAngle?: number,
 *   definitionName?: string,
 * }} [tool]
 * @param {number} [depth]
 */
const cuttingDiameter = (tool = DEFAULT_VBIT, depth = DEFAULT_ISOLATION_DEPTH) => {
    const diameter = Number(tool.toolDiameter);
    const angle = Number(tool.toolAngle);
    const cutDepth = Number(depth);
    if (!(diameter > 0)) {
        return null;
    }
    if (isVbit(tool) && angle > 0 && angle < 180 && cutDepth > 0) {
        const widthAtDepth = 2 * cutDepth * Math.tan((angle / 2) * (Math.PI / 180));
        return Math.min(diameter, widthAtDepth);
    }
    return diameter;
};

// Deepest target depth, in 0.1 mm steps, whose cutting width still fits `gap`.
const recommendedIsolationDepth = (tool, gap) => {
    const clearance = Number(gap);
    const angle = Number(tool && tool.toolAngle);
    if (!(clearance > 0) || !isVbit(tool || {}) || !(angle > 0) || !(angle < 180)) {
        return null;
    }
    const raw = clearance / (2 * Math.tan((angle / 2) * (Math.PI / 180)));
    const stepped = Math.floor((raw * 10) + 1e-9) / 10;
    if (!(stepped >= 0.1)) {
        return null;
    }
    const width = cuttingDiameter(tool, stepped);
    if (!(width > 0) || width > clearance + 1e-6) {
        return null;
    }
    return stepped;
};

export {
    DEFAULT_VBIT,
    DEFAULT_ISOLATION_DEPTH,
    cuttingDiameter,
    recommendedIsolationDepth,
};
