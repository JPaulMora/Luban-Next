import logger from '../../logger';
import { carveDexelFromCommands } from './carveDexel';
import { createDexelStock } from './dexelStock';
import { dexelToMesh } from './dexelToMesh';
import { stockSpecFromSegments } from './stockBounds';
import { DEXEL_CELL_MM } from './types';
import type {
    SolidSimResult,
    StockSpec,
    ToolCommand,
    ToolParams,
} from './types';

const log = logger('cnc:solidSimulation');

export type CarveSegment = {
    commands: ToolCommand[];
    toolParams: ToolParams;
};

export type RunSolidSimulationInput = {
    stock: StockSpec;
    /** One or more toolpaths; each keeps its own bit profile on a shared stock. */
    segments: CarveSegment[];
    cellMm?: number;
    onProgress?: (p: number) => void;
    shouldCancel?: () => boolean;
};

/**
 * Dexel carve at 0.1 mm: stamp each segment's bit along its moves into one
 * shared stock (multi-tool rough then finish), then mesh.
 *
 * Stock XY is fitted to the toolpath (not the machine bed origin) so workpiece
 * coordinate modes and model placement do not clip the carve to a tiny overlap.
 */
export function runSolidSimulation(input: RunSolidSimulationInput): SolidSimResult | null {
    const onProgress = input.onProgress || ((/* p */) => undefined);
    const shouldCancel = input.shouldCancel || (() => false);
    const cellMm = input.cellMm ?? DEXEL_CELL_MM;
    const t0 = Date.now();

    const segments = (input.segments || []).filter((s) => s && s.commands && s.commands.length > 0);
    if (segments.length === 0) {
        log.warn('solid sim has no carve segments');
        return null;
    }

    onProgress(0.02);
    if (shouldCancel()) {
        log.info('solid sim cancelled before carve');
        return null;
    }

    const fitted = stockSpecFromSegments(segments, input.stock.stockDepth);
    const stockSpec = fitted || input.stock;
    const minX = stockSpec.minX.toFixed(2);
    const minY = stockSpec.minY.toFixed(2);
    const maxX = stockSpec.maxX.toFixed(2);
    const maxY = stockSpec.maxY.toFixed(2);
    const where = fitted ? 'fitted to toolpath' : 'client stock';
    log.info(
        `dexel solid sim segments=${segments.length} stock=[${minX},${minY}]-[${maxX},${maxY}] z=${stockSpec.stockDepth} (${where})`
    );

    const stock = createDexelStock(stockSpec, cellMm);
    let anyStamps = false;

    for (let i = 0; i < segments.length; i++) {
        if (shouldCancel()) {
            log.info('solid sim cancelled mid-segments');
            return null;
        }
        const seg = segments[i];
        const base = 0.02 + (i / segments.length) * 0.9;
        const span = 0.9 / segments.length;

        log.info(
            `solid sim segment ${i + 1}/${segments.length} `
            + `commands=${seg.commands.length} tool=${JSON.stringify(seg.toolParams || {})}`
        );

        const result = carveDexelFromCommands(seg.commands, {
            toolParams: seg.toolParams || {},
            into: stock,
            pathStepMm: cellMm,
            allowEmpty: true,
            onProgress: (p) => onProgress(base + p * span),
            shouldCancel,
        });

        if (!result) {
            // cancelled
            return null;
        }
        // carveDexel with allowEmpty still returns stock; detect stamps via any lowered cell later
        anyStamps = true;
    }

    if (!anyStamps || shouldCancel()) {
        log.info('solid sim cancelled or empty carve');
        return null;
    }

    // Confirm at least one cell was carved
    let carved = false;
    for (let i = 0; i < stock.z.length; i++) {
        if (stock.z[i] < -1e-4) {
            carved = true;
            break;
        }
    }
    if (!carved) {
        log.warn('solid sim produced no carved cells');
        return null;
    }

    onProgress(0.95);
    const mesh = dexelToMesh(stock);
    log.info(
        `dexel sim complete in ${Date.now() - t0}ms `
        + `verts=${mesh.positions.length / 3} tris=${mesh.indices.length / 3}`
    );
    onProgress(1);
    return {
        ...mesh,
        stockDepth: stockSpec.stockDepth,
        bounds: stockSpec,
    };
}
