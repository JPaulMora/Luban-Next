import fs from 'fs';

import type { SolidSimResult } from './types';

const CHUNK = 8192;

/** Write a flat number array as a JSON array without JSON.stringify (avoids stack overflow). */
function writeNumberArray(fd: number, values: ArrayLike<number>): void {
    fs.writeSync(fd, '[');
    const n = values.length;
    for (let i = 0; i < n; i += CHUNK) {
        const end = Math.min(n, i + CHUNK);
        let chunk = '';
        for (let j = i; j < end; j++) {
            if (j > 0) {
                chunk += ',';
            }
            chunk += values[j];
        }
        fs.writeSync(fd, chunk);
    }
    fs.writeSync(fd, ']');
}

/**
 * Stream a solid-sim mesh to disk. Large V-bit meshes blow V8's JSON.stringify stack.
 */
export function writeMeshJson(filePath: string, result: SolidSimResult): void {
    const fd = fs.openSync(filePath, 'w');
    try {
        fs.writeSync(fd, '{"kind":"solidSim","stockDepth":');
        fs.writeSync(fd, String(result.stockDepth));
        fs.writeSync(fd, ',"bounds":');
        fs.writeSync(fd, JSON.stringify(result.bounds));
        fs.writeSync(fd, ',"positions":');
        writeNumberArray(fd, result.positions);
        fs.writeSync(fd, ',"normals":');
        writeNumberArray(fd, result.normals);
        fs.writeSync(fd, ',"indices":');
        writeNumberArray(fd, result.indices);
        fs.writeSync(fd, '}');
    } finally {
        fs.closeSync(fd);
    }
}
