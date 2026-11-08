import fs from 'fs';

import { pathWithRandomSuffix } from '../../../../shared/lib/random-utils';
import { runSolidSimulation } from '../../../lib/cnc/solidSimulation';
import type { CarveSegment, ToolCommand, ToolParams, StockSpec } from '../../../lib/cnc/solidSimulation';
import { writeMeshJson } from '../../../lib/cnc/solidSimulation/writeMeshJson';
import logger from '../../../lib/logger';
import sendMessage from '../utils/sendMessage';

const log = logger('worker:generateSolidSimulation');

type ToolPathFileEntry = {
    filename: string;
    toolParams?: ToolParams;
    positionX?: number;
    positionY?: number;
};

type SolidSimTaskData = {
    toolPathFiles: ToolPathFileEntry[];
    /** @deprecated Prefer per-file toolParams; kept as fallback for older callers. */
    toolParams?: ToolParams;
    stock: StockSpec;
};

function loadCommandsFromToolPathFile(entry: ToolPathFileEntry): ToolCommand[] {
    const filePath = `${process.env.Tmpdir}/${entry.filename}`;
    if (!fs.existsSync(filePath)) {
        throw new Error(`Toolpath file missing: ${entry.filename}`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const data = Array.isArray(raw.data) ? raw.data : [];
    const ox = entry.positionX ?? raw.positionX ?? 0;
    const oy = entry.positionY ?? raw.positionY ?? 0;

    return data.map((cmd: ToolCommand) => {
        const next = { ...cmd };
        if (next.X !== undefined) {
            next.X += ox;
        }
        if (next.Y !== undefined) {
            next.Y += oy;
        }
        return next;
    });
}

const generateSolidSimulation = (taskData: SolidSimTaskData) => {
    const startedAt = Date.now();
    let lastLoggedProgress = -1;

    const onProgress = (num: number) => {
        sendMessage({ status: 'progress', value: num });
        const pct = Math.round(num * 100);
        if (pct >= lastLoggedProgress + 5 || lastLoggedProgress < 0) {
            lastLoggedProgress = pct;
            log.info(`solid sim progress ${pct}%`);
        }
    };

    try {
        log.info('solid sim start (dexel 0.1mm)');
        if (!taskData || !Array.isArray(taskData.toolPathFiles) || taskData.toolPathFiles.length === 0) {
            throw new Error('No toolpath files for solid simulation');
        }
        if (!taskData.stock || !(taskData.stock.stockDepth > 0)) {
            throw new Error('Invalid stock for solid simulation');
        }

        const stock = taskData.stock;
        log.info(
            `solid sim files=${taskData.toolPathFiles.length} `
            + `stock=[${stock.minX},${stock.minY}]-[${stock.maxX},${stock.maxY}] z=${stock.stockDepth}`
        );

        onProgress(0.01);
        const segments: CarveSegment[] = [];
        const fallbackTool = taskData.toolParams || {};

        for (let i = 0; i < taskData.toolPathFiles.length; i++) {
            const entry = taskData.toolPathFiles[i];
            if (!entry || !entry.filename) {
                continue;
            }
            log.info(
                `solid sim load toolpath ${i + 1}/${taskData.toolPathFiles.length}: ${entry.filename} `
                + `tool=${JSON.stringify(entry.toolParams || fallbackTool)}`
            );
            const commands = loadCommandsFromToolPathFile(entry);
            log.info(`solid sim loaded ${commands.length} commands from ${entry.filename}`);
            if (commands.length === 0) {
                continue;
            }
            segments.push({
                commands,
                toolParams: entry.toolParams || fallbackTool,
            });
            onProgress(0.01 + (0.04 * (i + 1)) / taskData.toolPathFiles.length);
        }

        if (segments.length === 0) {
            throw new Error('Toolpath commands are empty');
        }
        log.info(`solid sim segments=${segments.length}`);

        const result = runSolidSimulation({
            segments,
            stock: taskData.stock,
            onProgress: (p) => onProgress(0.05 + p * 0.9),
        });

        if (!result) {
            throw new Error('Solid simulation cancelled or produced no mesh');
        }

        log.info(
            `solid sim mesh verts=${result.positions.length / 3} tris=${result.indices.length / 3}`
        );

        const outputFilename = pathWithRandomSuffix('solid-sim.json');
        const outputFilePath = `${process.env.Tmpdir}/${outputFilename}`;
        writeMeshJson(outputFilePath, result);

        const elapsedMs = Date.now() - startedAt;
        log.info(`solid sim complete file=${outputFilename} elapsedMs=${elapsedMs}`);

        return sendMessage({
            status: 'complete',
            value: {
                solidSimFile: outputFilename,
            },
        });
    } catch (e) {
        const elapsedMs = Date.now() - startedAt;
        const message = e && e.message ? e.message : String(e);
        log.error(`solid sim failed after ${elapsedMs}ms: ${message}`);
        if (e && e.stack) {
            log.error(e.stack);
        }
        return sendMessage({
            status: 'fail',
            value: message,
        });
    }
};

export default generateSolidSimulation;
