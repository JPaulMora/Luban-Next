import logger from '../../logger';
import { carveDexelFromCommands } from './carveDexel';
import { dexelToMesh } from './dexelToMesh';
import type {
    SolidSimResult,
    StockSpec,
    ToolCommand,
    ToolParams,
} from './types';

const log = logger('cnc:solidSimulation');

export type RunSolidSimulationInput = {
    commands: ToolCommand[];
    toolParams: ToolParams;
    stock: StockSpec;
    onProgress?: (p: number) => void;
    shouldCancel?: () => boolean;
};

/**
 * Dexel carve at 0.1 mm: stamp flat/ball/V bit along the toolpath, then mesh.
 */
export function runSolidSimulation(input: RunSolidSimulationInput): SolidSimResult | null {
    const onProgress = input.onProgress || ((/* p */) => undefined);
    const shouldCancel = input.shouldCancel || (() => false);
    const t0 = Date.now();

    onProgress(0.02);
    if (shouldCancel()) {
        log.info('solid sim cancelled before carve');
        return null;
    }

    log.info(`dexel solid sim from ${input.commands.length} commands`);

    const stock = carveDexelFromCommands(input.commands, {
        toolParams: input.toolParams,
        stock: input.stock,
        onProgress: (p) => onProgress(0.02 + p * 0.9),
        shouldCancel,
    });

    if (!stock || shouldCancel()) {
        log.info('solid sim cancelled or empty carve');
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
        stockDepth: input.stock.stockDepth,
        bounds: input.stock,
    };
}
