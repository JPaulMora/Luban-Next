import type { ToolParams } from './solidSimulation/types';

/**
 * Width of a V-bit at `targetDepth`. The stock Carving V-bit stores the
 * shank (3.175 mm) as `toolDiameter`. Lunar offsets a Fill by that full
 * width, so any region narrower than the shank is skipped.
 * The bit is only as wide as the cone at the programmed depth, and never
 * wider than the flute diameter stored on the tool.
 */
export function vbitPocketDiameter(toolParams: ToolParams = {}, targetDepth?: number): number | null {
    const hint = `${toolParams.toolType || ''} ${toolParams.definitionName || ''} ${toolParams.definitionId || ''}`.toLowerCase();
    const isVbit = hint.includes('vbit') || hint.includes('v-bit');
    if (!isVbit) {
        return null;
    }
    const diameter = Number(toolParams.toolDiameter);
    const angle = Number(toolParams.toolAngle);
    const depth = Number(targetDepth);
    if (!(diameter > 0) || !(angle > 0) || angle >= 180 || !(depth > 0)) {
        return null;
    }
    const widthAtDepth = 2 * depth * Math.tan((angle / 2) * Math.PI / 180);
    const cutting = Math.min(diameter, widthAtDepth);
    if (!(cutting > 0) || Math.abs(cutting - diameter) < 1e-6) {
        return null;
    }
    return cutting;
}
