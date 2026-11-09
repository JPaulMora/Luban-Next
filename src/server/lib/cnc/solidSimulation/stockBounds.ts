import { resolveBitProfile } from './bitProfile';
import type { StockSpec, ToolCommand, ToolParams } from './types';

type SegmentLike = {
    commands: ToolCommand[];
    toolParams?: ToolParams;
};

/**
 * XY bounds that cover every toolpath sample, padded by the largest bit
 * shaft radius so edge stamps stay inside the dexel grid.
 */
export function stockSpecFromSegments(
    segments: SegmentLike[],
    stockDepth: number,
    padExtraMm = 1,
): StockSpec | null {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let maxRadius = 0;

    for (const seg of segments) {
        const profile = resolveBitProfile(seg.toolParams || {});
        maxRadius = Math.max(maxRadius, profile.shaftRadius, profile.radius);

        for (const cmd of seg.commands) {
            if (cmd.X !== undefined && Number.isFinite(cmd.X)) {
                if (cmd.X < minX) minX = cmd.X;
                if (cmd.X > maxX) maxX = cmd.X;
            }
            if (cmd.Y !== undefined && Number.isFinite(cmd.Y)) {
                if (cmd.Y < minY) minY = cmd.Y;
                if (cmd.Y > maxY) maxY = cmd.Y;
            }
        }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null;
    }

    const pad = Math.max(0, maxRadius) + Math.max(0, padExtraMm);
    // Degenerate path (single point): still give the grid a bit of size
    if (maxX - minX < 1e-6) {
        minX -= 1;
        maxX += 1;
    }
    if (maxY - minY < 1e-6) {
        minY -= 1;
        maxY += 1;
    }

    return {
        minX: minX - pad,
        maxX: maxX + pad,
        minY: minY - pad,
        maxY: maxY + pad,
        stockDepth: Math.max(1e-3, stockDepth),
    };
}
