import { DEXEL_CELL_MM } from './types';
import type { StockSpec } from './types';

/**
 * XY dexel grid: each cell stores the current stock surface Z
 * (stock top starts at 0; floor is -stockDepth).
 */
export type DexelStock = {
    cellMm: number;
    nx: number;
    ny: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    stockDepth: number;
    /** Row-major: index = iy * nx + ix. Values are surface Z. */
    z: Float32Array;
};

export function createDexelStock(spec: StockSpec, cellMm = DEXEL_CELL_MM): DexelStock {
    const cell = Math.max(1e-3, cellMm);
    const sizeX = Math.max(cell, spec.maxX - spec.minX);
    const sizeY = Math.max(cell, spec.maxY - spec.minY);
    const nx = Math.max(1, Math.ceil(sizeX / cell));
    const ny = Math.max(1, Math.ceil(sizeY / cell));
    const z = new Float32Array(nx * ny);
    // Top surface at z = 0
    z.fill(0);
    return {
        cellMm: cell,
        nx,
        ny,
        minX: spec.minX,
        minY: spec.minY,
        maxX: spec.minX + nx * cell,
        maxY: spec.minY + ny * cell,
        stockDepth: Math.max(1e-3, spec.stockDepth),
        z,
    };
}

export function worldToIx(stock: DexelStock, x: number): number {
    return Math.floor((x - stock.minX) / stock.cellMm);
}

export function worldToIy(stock: DexelStock, y: number): number {
    return Math.floor((y - stock.minY) / stock.cellMm);
}

export function cellCenterX(stock: DexelStock, ix: number): number {
    return stock.minX + (ix + 0.5) * stock.cellMm;
}

export function cellCenterY(stock: DexelStock, iy: number): number {
    return stock.minY + (iy + 0.5) * stock.cellMm;
}

export function floorZ(stock: DexelStock): number {
    return -stock.stockDepth;
}

/** Lower cell surface to at most `surfaceZ` (clamped to stock floor). */
export function carveCell(stock: DexelStock, ix: number, iy: number, surfaceZ: number): void {
    if (ix < 0 || iy < 0 || ix >= stock.nx || iy >= stock.ny) {
        return;
    }
    const idx = iy * stock.nx + ix;
    const z = Math.max(floorZ(stock), surfaceZ);
    if (z < stock.z[idx]) {
        stock.z[idx] = z;
    }
}
