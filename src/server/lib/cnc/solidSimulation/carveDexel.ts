import logger from '../../logger';
import { resolveBitProfile } from './bitProfile';
import { stampBitAtTip } from './bitStamp';
import { forEachCuttingMove } from './cuttingMotion';
import { createDexelStock } from './dexelStock';
import type { DexelStock } from './dexelStock';
import { DEXEL_CELL_MM, DEXEL_PATH_STEP_MM } from './types';
import type { StockSpec, ToolCommand, ToolParams, Vec3 } from './types';

const log = logger('cnc:solidSimulation');

export type CarveDexelOptions = {
    toolParams: ToolParams;
    /** Create a new stock from this spec (ignored if `into` is set). */
    stock?: StockSpec;
    /** Carve into an existing dexel grid (multi-tool sequential). */
    into?: DexelStock;
    cellMm?: number;
    pathStepMm?: number;
    onProgress?: (p: number) => void;
    shouldCancel?: () => boolean;
    /** When true, zero stamps is OK (e.g. air-only segment). */
    allowEmpty?: boolean;
};

function sampleSegment(from: Vec3, to: Vec3, stepMm: number, onPoint: (p: Vec3) => void): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-9) {
        onPoint(to);
        return;
    }
    const step = Math.max(1e-3, stepMm);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        onPoint({
            x: from.x + dx * t,
            y: from.y + dy * t,
            z: from.z + dz * t,
        });
    }
}

/**
 * Walk cutting moves and stamp the bit into a dexel stock grid.
 * Pass `into` to accumulate into an existing stock (multi-tool).
 */
export function carveDexelFromCommands(
    commands: ToolCommand[],
    options: CarveDexelOptions,
): DexelStock | null {
    const cellMm = options.cellMm ?? DEXEL_CELL_MM;
    const pathStepMm = options.pathStepMm ?? DEXEL_PATH_STEP_MM;
    const profile = resolveBitProfile(options.toolParams);

    let stock: DexelStock;
    if (options.into) {
        stock = options.into;
    } else if (options.stock) {
        stock = createDexelStock(options.stock, cellMm);
    } else {
        throw new Error('carveDexelFromCommands requires stock or into');
    }

    log.info(
        `dexel carve bit=${profile.kind} d=${profile.diameter} `
        + `cell=${stock.cellMm}mm grid=${stock.nx}x${stock.ny} `
        + `commands=${commands.length}`
    );

    let cancelled = false;
    let stamps = 0;
    let lastLoggedLine = 0;
    const lineTotal = Math.max(1, commands.length);

    forEachCuttingMove(
        commands,
        { stockTopZ: 0 },
        {
            onMove: (move) => {
                if (options.shouldCancel && options.shouldCancel()) {
                    cancelled = true;
                    return false;
                }

                sampleSegment(move.prev, move.next, pathStepMm, (p) => {
                    stampBitAtTip(stock, profile, p.x, p.y, p.z);
                    stamps += 1;
                });

                if (options.onProgress) {
                    options.onProgress(Math.min(0.95, move.line / lineTotal));
                }
                const step = Math.max(1, Math.floor(lineTotal / 20));
                if (move.line - lastLoggedLine >= step || move.line <= 5 || move.line === lineTotal) {
                    lastLoggedLine = move.line;
                    log.info(
                        `gcode ${move.line}/${lineTotal} stamps=${stamps} `
                        + `bit=${profile.kind} grid=${stock.nx}x${stock.ny}`
                    );
                }
                return undefined;
            },
        },
    );

    if (cancelled) {
        log.info('dexel carve cancelled');
        return null;
    }

    if (stamps === 0 && !options.allowEmpty) {
        log.warn('dexel carve produced no stamps');
        return null;
    }

    log.info(`dexel carve done stamps=${stamps} bit=${profile.kind}`);
    if (options.onProgress) {
        options.onProgress(0.95);
    }
    return stock;
}
