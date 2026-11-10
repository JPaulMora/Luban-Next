#!/usr/bin/env node

// Interstate Regular. A capital T is 40 mm tall, and any other text is
// set at that same size. The floor sits 0.2 mm under the deepest groove.
// Each outline edge becomes one plane, cut in at 45° so the two sides
// of a stroke meet at its center.
//
//   node scripts/chisel-t.js
//   node scripts/chisel-t.js "TO"
//   node scripts/chisel-t.js "TO" output/chisel-TO.stl

require('@babel/register');
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');
const chisel = require('../src/server/lib/chisel');

const FONT = path.join(__dirname, '../src/app/resources/fonts/Interstate-Regular-webfont.ttf');
const HEIGHT_MM = 40;

function parseArgs(argv) {
    const given = argv.slice(2);
    let text = 'T';
    let out = null;
    if (given.length === 1 && given[0].endsWith('.stl')) {
        out = given[0];
    } else if (given.length >= 1) {
        text = given[0];
        out = given[1] || null;
    }
    if (!text.trim()) {
        text = 'T';
    }
    return { text, out };
}

function slug(text) {
    const clean = text.trim().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return clean || 'text';
}

function preview(faces, width, height) {
    const across = 48;
    const down = 24;
    const lines = [];
    const inside = (x, y, face) => {
        let hits = false;
        for (let i = 0, j = face.length - 1; i < face.length; j = i, i += 1) {
            const yi = face[i][1];
            const yj = face[j][1];
            if ((yi > y) === (yj > y)) {
                continue;
            }
            const xi = face[i][0];
            const xj = face[j][0];
            if (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi) {
                hits = !hits;
            }
        }
        return hits;
    };
    const depthOn = (x, y, face) => {
        const origin = face[0];
        for (let i = 1; i < face.length - 1; i += 1) {
            const b = face[i];
            const c = face[i + 1];
            const ux = b[0] - origin[0];
            const uy = b[1] - origin[1];
            const uz = b[2] - origin[2];
            const vx = c[0] - origin[0];
            const vy = c[1] - origin[1];
            const vz = c[2] - origin[2];
            const nz = (ux * vy) - (uy * vx);
            if (Math.abs(nz) < 1e-8) {
                continue;
            }
            const nx = (uy * vz) - (uz * vy);
            const ny = (uz * vx) - (ux * vz);
            return -(origin[2] - (((nx * (x - origin[0])) + (ny * (y - origin[1]))) / nz));
        }
        return 0;
    };
    for (let row = down - 1; row >= 0; row -= 1) {
        let line = '';
        const y = (row / (down - 1)) * height;
        for (let col = 0; col < across; col += 1) {
            const x = (col / (across - 1)) * width;
            let depth = 0;
            for (let i = 0; i < faces.length; i += 1) {
                if (inside(x, y, faces[i])) {
                    depth = depthOn(x, y, faces[i]);
                    break;
                }
            }
            if (depth < 0.2) {
                line += ' ';
            } else if (depth < 1.2) {
                line += '.';
            } else if (depth < 2.4) {
                line += '+';
            } else {
                line += '#';
            }
        }
        lines.push(line);
    }
    return lines.join('\n');
}

function solidFor(text) {
    const font = opentype.loadSync(FONT);
    const capital = font.getPath('T', 0, 0, 1000).getBoundingBox();
    const scale = HEIGHT_MM / (capital.y2 - capital.y1);
    const glyphPath = font.getPath(text, 0, 0, 1000);
    const box = glyphPath.getBoundingBox();
    if (![box.x1, box.y1, box.x2, box.y2].every(Number.isFinite) || !(box.x2 > box.x1)) {
        throw new Error(`No outline for ${JSON.stringify(text)}`);
    }
    const solid = chisel.solidFromCommands(glyphPath.commands, scale, box);
    if (!solid) {
        throw new Error(`No outline for ${JSON.stringify(text)}`);
    }
    return solid;
}

function main() {
    const { text, out } = parseArgs(process.argv);
    const file = path.resolve(out || path.join(__dirname, '../output', `chisel-${slug(text)}.stl`));
    const solid = solidFor(text);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, chisel.stlBuffer(solid.triangles));
    process.stdout.write([
        `text ${text}`,
        'font Interstate Regular',
        `box ${solid.width.toFixed(2)} x ${solid.height.toFixed(2)} mm`,
        `thickness ${solid.thickness.toFixed(2)} mm`,
        `chisel faces ${solid.faces.length}`,
        `triangles ${solid.triangles.length / 9}`,
        `wrote ${file}`,
        '',
        preview(solid.faces, solid.width, solid.height),
        ''
    ].join('\n'));
}

if (require.main === module) {
    main();
}
