import type { ToolParams } from './solidSimulation/types';

// Same default as the CNC tool profile when the type is a V-bit.
const VBIT_TIP_MM = 0.2;

function isVbit(toolParams: ToolParams): boolean {
    const hint = `${toolParams.toolType || ''} ${toolParams.definitionName || ''} ${toolParams.definitionId || ''}`.toLowerCase();
    return hint.includes('vbit') || hint.includes('v-bit');
}

/**
 * Width of a V-bit at `targetDepth`. The stock Carving V-bit stores the
 * shank (3.175 mm) as `toolDiameter`. Lunar offsets a Fill by that full
 * width, so any region narrower than the shank is skipped.
 * The bit is only as wide as the cone at the programmed depth, and never
 * wider than the flute diameter stored on the tool.
 */
export function vbitPocketDiameter(toolParams: ToolParams = {}, targetDepth?: number): number | null {
    if (!isVbit(toolParams)) {
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

/**
 * Tip width to send for a relief. Lunar stamps a flat of `toolDiameter`
 * across the height image, so a Carving V-bit whose diameter is the shank
 * (3.175 mm) cuts every peak down to a pad of that width.
 * The profile's real tip default is 0.2 mm. Use that when the stored
 * diameter is the shank. A diameter the user already set smaller is kept.
 */
export function vbitReliefTipDiameter(toolParams: ToolParams = {}): number | null {
    if (!isVbit(toolParams)) {
        return null;
    }
    const diameter = Number(toolParams.toolDiameter);
    const shaft = Number(toolParams.toolShaftDiameter);
    const angle = Number(toolParams.toolAngle);
    if (!(diameter > 0) || !(shaft > 0) || !(angle > 0) || angle >= 180) {
        return null;
    }
    if (Math.abs(diameter - shaft) > 0.05 || diameter <= VBIT_TIP_MM) {
        return null;
    }
    return VBIT_TIP_MM;
}
