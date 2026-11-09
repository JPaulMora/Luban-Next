import logger from '../../logger';
import { cellCenterX, cellCenterY, floorZ } from './dexelStock';
import type { DexelStock } from './dexelStock';
import type { MeshBuffers } from './types';

const log = logger('cnc:solidSimulation');

const CARVE_EPS = 1e-4; // used to detect any carved cell for ROI

// A full-bed 0.1 mm relief is ~2 million cells. One quad per cell is too
// large for the renderer to parse (Atitlan was ~8 million vertices and the
// preview stayed at 95%). Carve resolution stays 0.1 mm; the display mesh
// samples blocks so the quad count stays under this cap.
const DISPLAY_MAX_QUADS = 90000;

type PushVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number;
type PushTri = (a: number, b: number, c: number) => void;

function makeBuilders(positions: number[], normals: number[], indices: number[]) {
    const pushVertex: PushVertex = (x, y, z, nx, ny, nz) => {
        const i = positions.length / 3;
        positions.push(x, y, z);
        normals.push(nx, ny, nz);
        return i;
    };
    const pushTri: PushTri = (a, b, c) => {
        indices.push(a, b, c);
    };
    const pushQuad = (
        ax: number, ay: number, az: number,
        bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number,
        dx: number, dy: number, dz: number,
        nx: number, ny: number, nz: number,
    ) => {
        const a = pushVertex(ax, ay, az, nx, ny, nz);
        const b = pushVertex(bx, by, bz, nx, ny, nz);
        const c = pushVertex(cx, cy, cz, nx, ny, nz);
        const d = pushVertex(dx, dy, dz, nx, ny, nz);
        pushTri(a, b, c);
        pushTri(a, c, d);
    };
    return { pushVertex, pushTri, pushQuad };
}

function sampleIndices(start: number, end: number, step: number): number[] {
    const out = [start];
    if (end === start) {
        return out;
    }
    for (let i = start + step; i < end; i += step) {
        out.push(i);
    }
    if (out[out.length - 1] !== end) {
        out.push(end);
    }
    return out;
}

/** Deepest surface in the step×step block whose corner is this cell. */
function minZInBlock(stock: DexelStock, ix: number, iy: number, step: number): number {
    const x1 = Math.min(stock.nx, ix + Math.max(1, step));
    const y1 = Math.min(stock.ny, iy + Math.max(1, step));
    let minZ = 0;
    for (let y = iy; y < y1; y++) {
        const row = y * stock.nx;
        for (let x = ix; x < x1; x++) {
            const value = stock.z[row + x];
            if (value < minZ) {
                minZ = value;
            }
        }
    }
    return minZ;
}

function stockBoxMesh(stock: DexelStock): MeshBuffers {
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const { pushQuad } = makeBuilders(positions, normals, indices);
    const zFloor = floorZ(stock);
    const top = 0;
    const { minX, maxX, minY, maxY } = stock;

    pushQuad(minX, minY, top, maxX, minY, top, maxX, maxY, top, minX, maxY, top, 0, 0, 1);
    pushQuad(minX, minY, zFloor, minX, maxY, zFloor, maxX, maxY, zFloor, maxX, minY, zFloor, 0, 0, -1);
    pushQuad(minX, minY, top, maxX, minY, top, maxX, minY, zFloor, minX, minY, zFloor, 0, -1, 0);
    pushQuad(maxX, minY, top, maxX, maxY, top, maxX, maxY, zFloor, maxX, minY, zFloor, 1, 0, 0);
    pushQuad(maxX, maxY, top, minX, maxY, top, minX, maxY, zFloor, maxX, maxY, zFloor, 0, 1, 0);
    pushQuad(minX, maxY, top, minX, minY, top, minX, minY, zFloor, minX, maxY, zFloor, -1, 0, 0);

    return { positions, normals, indices };
}

/**
 * Convert dexel heightfield to a triangle mesh.
 * Crops to the carved region (plus a 1-cell border) and skips fully uncarved
 * top quads so large stocks with a small V-bit cut stay meshable / serializable.
 */
export function dexelToMesh(stock: DexelStock): MeshBuffers {
    const { nx, ny, z } = stock;
    const zFloor = floorZ(stock);

    let ix0 = nx;
    let ix1 = -1;
    let iy0 = ny;
    let iy1 = -1;
    for (let iy = 0; iy < ny; iy++) {
        const row = iy * nx;
        for (let ix = 0; ix < nx; ix++) {
            if (z[row + ix] < -CARVE_EPS) {
                if (ix < ix0) ix0 = ix;
                if (ix > ix1) ix1 = ix;
                if (iy < iy0) iy0 = iy;
                if (iy > iy1) iy1 = iy;
            }
        }
    }

    if (ix1 < ix0) {
        return stockBoxMesh(stock);
    }

    ix0 = Math.max(0, ix0 - 1);
    iy0 = Math.max(0, iy0 - 1);
    ix1 = Math.min(nx - 1, ix1 + 1);
    iy1 = Math.min(ny - 1, iy1 + 1);

    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const { pushVertex, pushTri, pushQuad } = makeBuilders(positions, normals, indices);

    const spanX = Math.max(1, ix1 - ix0);
    const spanY = Math.max(1, iy1 - iy0);
    const step = spanX * spanY > DISPLAY_MAX_QUADS
        ? Math.ceil(Math.sqrt((spanX * spanY) / DISPLAY_MAX_QUADS))
        : 1;
    if (step > 1) {
        log.info(
            `dexel mesh display step=${step} (${(step * stock.cellMm).toFixed(2)} mm) `
            + `from ${spanX}x${spanY} cells`
        );
    }

    const xs = sampleIndices(ix0, ix1, step);
    const ys = sampleIndices(iy0, iy1, step);
    const sampleZ = (ix: number, iy: number) => minZInBlock(stock, ix, iy, step);

    for (let j = 0; j < ys.length - 1; j++) {
        for (let i = 0; i < xs.length - 1; i++) {
            const ix = xs[i];
            const ixNext = xs[i + 1];
            const iy = ys[j];
            const iyNext = ys[j + 1];

            const z00 = sampleZ(ix, iy);
            const z10 = sampleZ(ixNext, iy);
            const z01 = sampleZ(ix, iyNext);
            const z11 = sampleZ(ixNext, iyNext);

            const x0 = cellCenterX(stock, ix);
            const x1 = cellCenterX(stock, ixNext);
            const y0 = cellCenterY(stock, iy);
            const y1 = cellCenterY(stock, iyNext);

            const ax = x1 - x0;
            const az = z10 - z00;
            const by = y1 - y0;
            const bz = z01 - z00;
            // cross(ax, 0, az) × (0, by, bz)
            let nxn = -az * by;
            let nyn = -ax * bz;
            let nzn = ax * by;
            const len = Math.sqrt(nxn * nxn + nyn * nyn + nzn * nzn) || 1;
            nxn /= len;
            nyn /= len;
            nzn /= len;
            if (nzn < 0) {
                nxn = -nxn;
                nyn = -nyn;
                nzn = -nzn;
            }

            const v00 = pushVertex(x0, y0, z00, nxn, nyn, nzn);
            const v10 = pushVertex(x1, y0, z10, nxn, nyn, nzn);
            const v01 = pushVertex(x0, y1, z01, nxn, nyn, nzn);
            const v11 = pushVertex(x1, y1, z11, nxn, nyn, nzn);
            pushTri(v00, v10, v11);
            pushTri(v00, v11, v01);
        }
    }

    const xLo = cellCenterX(stock, ix0) - stock.cellMm * 0.5;
    const xHi = cellCenterX(stock, ix1) + stock.cellMm * 0.5;
    const yLo = cellCenterY(stock, iy0) - stock.cellMm * 0.5;
    const yHi = cellCenterY(stock, iy1) + stock.cellMm * 0.5;
    const top = 0;

    pushQuad(xLo, yLo, zFloor, xLo, yHi, zFloor, xHi, yHi, zFloor, xHi, yLo, zFloor, 0, 0, -1);
    pushQuad(xLo, yLo, top, xHi, yLo, top, xHi, yLo, zFloor, xLo, yLo, zFloor, 0, -1, 0);
    pushQuad(xHi, yLo, top, xHi, yHi, top, xHi, yHi, zFloor, xHi, yLo, zFloor, 1, 0, 0);
    pushQuad(xHi, yHi, top, xLo, yHi, top, xLo, yHi, zFloor, xHi, yHi, zFloor, 0, 1, 0);
    pushQuad(xLo, yHi, top, xLo, yLo, top, xLo, yLo, zFloor, xLo, yHi, zFloor, -1, 0, 0);

    return { positions, normals, indices };
}
