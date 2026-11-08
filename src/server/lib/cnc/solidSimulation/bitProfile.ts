import type { ToolParams } from './types';

export type BitKind = 'flat' | 'ball' | 'vbit';

export type BitProfile = {
    kind: BitKind;
    /** Tip / cutting diameter (mm) */
    diameter: number;
    radius: number;
    /** Included V angle in degrees; only for vbit */
    angleDeg: number | null;
    shaftDiameter: number;
    shaftRadius: number;
};

const DEFAULT_DIAMETER = 3.175;

function nameHint(toolParams: ToolParams): string {
    return `${toolParams.toolType || ''} ${toolParams.definitionName || ''} ${toolParams.definitionId || ''}`.toLowerCase();
}

/**
 * Resolve cutter kind and sizes from toolParams.
 *
 * Luban flat end mills use tool_type "flat" and angle 180°. Prefer explicit
 * toolType / name; only treat acute angles as V-bits when type isn't flat.
 */
export function resolveBitProfile(toolParams: ToolParams = {}): BitProfile {
    const diameter = Number(toolParams.toolDiameter) > 0
        ? Number(toolParams.toolDiameter)
        : DEFAULT_DIAMETER;
    const shaftDiameter = Number(toolParams.toolShaftDiameter) > 0
        ? Number(toolParams.toolShaftDiameter)
        : diameter;
    const hint = nameHint(toolParams);
    const angle = Number(toolParams.toolAngle);
    const rawType = String(toolParams.toolType || '').toLowerCase();

    let kind: BitKind = 'flat';

    if (rawType === 'flat' || hint.includes('flat') || hint.includes('end mill') || hint.includes('endmill') || hint.includes('fem')) {
        kind = 'flat';
    } else if (rawType === 'ball' || hint.includes('ball')) {
        kind = 'ball';
    } else if (rawType === 'vbit' || rawType === 'v' || hint.includes('vbit') || hint.includes('v-bit') || hint.includes('v bit')) {
        // Angle 180° means straight / flat in Luban profiles even if type says vbit by mistake
        kind = Number.isFinite(angle) && angle > 0 && angle < 179 ? 'vbit' : 'flat';
    } else if (Number.isFinite(angle) && angle > 0 && angle < 179) {
        // Legacy: only angle present — treat near-180 as flat, else V-bit
        kind = 'vbit';
    } else {
        kind = 'flat';
    }

    return {
        kind,
        diameter,
        radius: diameter / 2,
        angleDeg: kind === 'vbit' ? angle : null,
        shaftDiameter,
        shaftRadius: shaftDiameter / 2,
    };
}

/**
 * Horizontal cutting radius of the bit at a height `h` above the tip (mm).
 * Used for V-bit / ball engagement at the stock surface.
 */
export function radiusAtHeightAboveTip(profile: BitProfile, heightAboveTip: number): number {
    const h = Math.max(0, heightAboveTip);
    if (profile.kind === 'flat') {
        return profile.radius;
    }
    if (profile.kind === 'ball') {
        if (h >= profile.radius) {
            return profile.radius;
        }
        // Sphere tip: radius of circle at height h from bottom
        const r = profile.radius;
        const y = h - r; // -r at tip, 0 at equator
        return Math.sqrt(Math.max(0, r * r - y * y));
    }
    // V-bit: half-angle from included angle
    const halfRad = ((profile.angleDeg as number) / 2) * (Math.PI / 180);
    const tan = Math.tan(halfRad);
    const r = h * tan;
    return Math.min(r, profile.shaftRadius);
}

/**
 * Radius of the removed footprint at the stock top when the tip is at tipZ
 * (tipZ is typically negative, stock top at 0).
 */
export function footprintRadiusAtStockTop(profile: BitProfile, tipZ: number, stockTopZ = 0): number {
    const heightAboveTip = Math.max(0, stockTopZ - tipZ);
    return radiusAtHeightAboveTip(profile, heightAboveTip);
}
