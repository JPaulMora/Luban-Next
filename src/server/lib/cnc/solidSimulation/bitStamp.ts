import type { BitProfile } from './bitProfile';
import { radiusAtHeightAboveTip } from './bitProfile';
import {
    carveCell,
    cellCenterX,
    cellCenterY,
    floorZ,
    worldToIx,
    worldToIy,
} from './dexelStock';
import type { DexelStock } from './dexelStock';

/**
 * Stock surface Z produced by the bit at world (x,y) when tip is at tipZ.
 * Returns null if (x,y) is outside the bit footprint.
 */
export function surfaceZUnderBit(
    profile: BitProfile,
    tipX: number,
    tipY: number,
    tipZ: number,
    x: number,
    y: number,
): number | null {
    const dx = x - tipX;
    const dy = y - tipY;
    const r2 = dx * dx + dy * dy;

    if (profile.kind === 'flat') {
        const r = profile.radius;
        if (r2 > r * r) {
            return null;
        }
        return tipZ;
    }

    if (profile.kind === 'ball') {
        const R = profile.radius;
        // Sphere center at tip + R along Z; tip is bottom of ball
        const cx = tipX;
        const cy = tipY;
        const cz = tipZ + R;
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (d2 > R * R) {
            return null;
        }
        // Lower hemisphere surface
        const surface = cz - Math.sqrt(Math.max(0, R * R - d2));
        return surface;
    }

    // V-bit: cone from tip; half-angle from included angle
    const angle = profile.angleDeg;
    if (!angle || angle <= 0 || angle >= 180) {
        const r = profile.radius;
        if (r2 > r * r) {
            return null;
        }
        return tipZ;
    }
    const halfRad = (angle / 2) * (Math.PI / 180);
    const tan = Math.tan(halfRad);
    if (tan < 1e-9) {
        return null;
    }
    const horiz = Math.sqrt(r2);
    if (horiz > profile.shaftRadius + 1e-9) {
        return null;
    }
    // Height above tip where cone has this radius
    const h = horiz / tan;
    return tipZ + h;
}

/**
 * Max XY radius the bit can affect at the current tip depth (for stamp bounds).
 */
export function stampRadiusXY(profile: BitProfile, tipZ: number, stockTopZ = 0): number {
    if (profile.kind === 'flat' || profile.kind === 'ball') {
        return profile.radius;
    }
    // V-bit footprint at stock top, already capped by shaft radius
    const depth = Math.max(0, stockTopZ - tipZ);
    return Math.max(profile.radius, Math.min(
        radiusAtHeightAboveTip(profile, depth),
        profile.shaftRadius,
    ));
}

/**
 * Stamp the bit at tip pose into the dexel stock (monotonic carve).
 */
export function stampBitAtTip(
    stock: DexelStock,
    profile: BitProfile,
    tipX: number,
    tipY: number,
    tipZ: number,
): void {
    if (tipZ >= 0) {
        // Tip at or above stock top — no engagement
        return;
    }
    if (tipZ <= floorZ(stock)) {
        // Fully through stock: still stamp footprint at floor
    }

    const rad = stampRadiusXY(profile, tipZ, 0) + stock.cellMm;
    const ix0 = worldToIx(stock, tipX - rad);
    const ix1 = worldToIx(stock, tipX + rad);
    const iy0 = worldToIy(stock, tipY - rad);
    const iy1 = worldToIy(stock, tipY + rad);

    for (let iy = iy0; iy <= iy1; iy++) {
        for (let ix = ix0; ix <= ix1; ix++) {
            if (ix < 0 || iy < 0 || ix >= stock.nx || iy >= stock.ny) {
                continue;
            }
            const x = cellCenterX(stock, ix);
            const y = cellCenterY(stock, iy);
            const surf = surfaceZUnderBit(profile, tipX, tipY, tipZ, x, y);
            if (surf === null) {
                continue;
            }
            carveCell(stock, ix, iy, surf);
        }
    }
}
