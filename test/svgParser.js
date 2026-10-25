import fs from 'fs';
import os from 'os';
import path from 'path';
import { test } from 'tape';

import SVGParser from '../src/shared/lib/SVGParser';
import { OVERRIDE_STYLE } from '../src/shared/lib/SVGParser/constants';
import { normalizePaint } from '../src/shared/lib/SVGParser/svgPaint';


const svg = (body) => (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${body}</svg>`
);

const findPalette = (palette, role, hex) => palette.find(entry => entry.role === role && entry.hex === hex);

test('normalizePaint lowercases hex and expands shorthand', (t) => {
    t.equal(normalizePaint('#ED1C24'), '#ed1c24');
    t.equal(normalizePaint('#F00'), '#ff0000');
    t.equal(normalizePaint('rgb(255, 0, 0)'), '#ff0000');
    t.equal(normalizePaint('none'), 'none');
    t.equal(normalizePaint('currentColor'), 'currentColor');
    t.equal(normalizePaint('url(#grad)'), null);
    t.end();
});

test('parser reads presentation attributes and skips none', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<path fill="#ED1C24" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path fill="none" stroke="#00FF00" d="M20 0 L30 0 L30 10 Z"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ed1c24').count, 1);
    t.equal(findPalette(result.colorPalette, 'stroke', '#00ff00').count, 1);
    t.equal(findPalette(result.colorPalette, 'fill', '#00ff00'), undefined);
    t.end();
});

test('parser reads inline style and inherited group fill', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<g fill="#0000ff">'
        + '<rect x="0" y="0" width="10" height="10"/>'
        + '<path style="fill:#ed1c24" d="M20 0 L30 0 L30 10 Z"/>'
        + '</g>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#0000ff').count, 1);
    t.equal(findPalette(result.colorPalette, 'fill', '#ed1c24').count, 1);
    t.end();
});

test('parser reads class rules from a defs style text node', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<defs><style>.cls-1{fill:#0073b7;}.cls-2{fill:#fff;}.cls-3{fill:#a6d434;}</style></defs>'
        + '<path class="cls-2" d="M0 0 L10 0 L10 10 Z"/>'
        + '<polygon class="cls-1" points="0,0 10,0 5,10"/>'
        + '<polygon class="cls-3" points="20,0 30,0 25,10"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ffffff').count, 1);
    t.equal(findPalette(result.colorPalette, 'fill', '#0073b7').count, 1);
    t.equal(findPalette(result.colorPalette, 'fill', '#a6d434').count, 1);
    t.end();
});

test('parser reads illustrator class rules', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<style type="text/css">.st0{fill:#ED1C24;}.st1{fill:none;stroke:#231F20;}</style>'
        + '<path class="st0" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path class="st1" d="M20 0 L30 0 L30 10 Z"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ed1c24').count, 1);
    t.equal(findPalette(result.colorPalette, 'stroke', '#231f20').count, 1);
    t.equal(findPalette(result.colorPalette, 'fill', '#231f20'), undefined);
    t.end();
});

test('parser normalizes mixed hex forms to one swatch', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<path fill="#F00" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path fill="#FF0000" d="M20 0 L30 0 L30 10 Z"/>'
        + '<path fill="red" d="M40 0 L50 0 L50 10 Z"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ff0000').count, 3);
    t.equal(result.colorPalette.length, 1);
    t.end();
});

test('parser resolves currentColor from the color property', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<path color="#ed1c24" fill="currentColor" d="M0 0 L10 0 L10 10 Z"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ed1c24').count, 1);
    t.end();
});

test('parser leaves gradients out of the palette', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
        + '<path fill="url(#g)" stroke="#0000ff" d="M0 0 L10 0 L10 10 Z"/>'
    ));

    t.equal(findPalette(result.colorPalette, 'fill', '#ff0000'), undefined);
    t.equal(findPalette(result.colorPalette, 'stroke', '#0000ff').count, 1);
    t.end();
});

test('unfiltered parsed svg still uses OVERRIDE_STYLE', async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'luban-svg-'));
    const filePath = path.join(dir, 'art.svg');
    fs.writeFileSync(filePath, svg(
        '<path fill="#ED1C24" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path fill="#00ff00" d="M20 0 L30 0 L30 10 Z"/>'
    ));

    const parser = new SVGParser();
    await parser.parseFile(filePath);
    const parsed = fs.readFileSync(path.join(dir, 'artparsed.svg'), 'utf8');

    t.ok(parsed.includes(OVERRIDE_STYLE));
    t.ok(parsed.includes('d="M0 0 L10 0 L10 10 Z"'));
    t.ok(parsed.includes('d="M20 0 L30 0 L30 10 Z"'));
    t.ok(!parsed.includes('#ED1C24'));
    t.ok(!parsed.includes('#ed1c24'));

    fs.rmSync(dir, { recursive: true, force: true });
    t.end();
});

test('filtered svg keeps OVERRIDE_STYLE and drops the other color', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<path fill="#ED1C24" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path fill="#00ff00" d="M20 0 L30 0 L30 10 Z"/>'
    ));
    const filtered = parser.generateFilteredString(result.parsedNode, [
        { role: 'fill', hex: '#ed1c24' }
    ]);

    t.ok(filtered.includes(OVERRIDE_STYLE));
    t.ok(filtered.includes('d="M0 0 L10 0 L10 10 Z"'));
    t.ok(!filtered.includes('d="M20 0 L30 0 L30 10 Z"'));
    t.end();
});

test('filtered svg matches stroke independently of fill', async (t) => {
    const parser = new SVGParser();
    const result = await parser.parse(svg(
        '<path fill="#ed1c24" stroke="#000000" d="M0 0 L10 0 L10 10 Z"/>'
        + '<path fill="#00ff00" d="M20 0 L30 0 L30 10 Z"/>'
    ));
    const filtered = parser.generateFilteredString(result.parsedNode, [
        { role: 'stroke', hex: '#000000' }
    ]);

    t.ok(filtered.includes('d="M0 0 L10 0 L10 10 Z"'));
    t.ok(!filtered.includes('d="M20 0 L30 0 L30 10 Z"'));
    t.end();
});
