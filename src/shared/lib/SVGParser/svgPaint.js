import { OVERRIDE_STYLE } from './constants';
import { parseFloats, cssColor2Hex } from './Utils';

export const FILTERED_FILL_STYLE = 'fill: #000; stroke: none; vector-effect: non-scaling-stroke;';
export const FILTERED_BOTH_STYLE = 'fill: #000; stroke: #000; stroke-width: 0.4px; vector-effect: non-scaling-stroke;';

export function isElementNode(node) {
    return node !== null && typeof node === 'object' && !Array.isArray(node);
}

function styleSheetText(styleNode) {
    if (typeof styleNode === 'string') {
        return styleNode;
    }
    if (styleNode && typeof styleNode._ === 'string') {
        return styleNode._;
    }
    return '';
}

export const GRAPHIC_TAGS = new Set([
    'circle',
    'ellipse',
    'line',
    'path',
    'polygon',
    'polyline',
    'rect',
    'text',
    'tspan',
    'image',
    'use'
]);

const DEFAULT_FILL = '#000000';
const DEFAULT_STROKE = 'none';
const DEFAULT_COLOR = '#000000';

export function parseColor(value) {
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Content_type#Color
    // hex, rgb, color-keyword
    value = value.trim();

    if (value[0] === '#') {
        // hex
        if (value.length === 4) {
            let hexColor = '#';
            for (let i = 1; i < 4; i++) {
                hexColor += value[i] + value[i];
            }
            return hexColor;
        } else {
            return value;
        }
    }

    // RGB
    if (value.startsWith('rgb(')) {
        value = value.substr(4);
        const floats = parseFloats(value);
        if (value.indexOf('%') === -1) {
            if (floats.length === 3) {
                const hexValue = 0x1000000 + 0x10000 * floats[0] + 0x100 * floats[1] + floats[2];
                return `#${Number(hexValue).toString(16).substr(1)}`;
            }
        } else if (floats.length === 3) {
            // in percentage
            const hexValue = 0x1000000 + 0x10000 * (floats[0] / 100) * 255 + 0x100 * (floats[1] / 100) * 255 + (floats[2] / 100) * 255;
            return `#${Number(hexValue).toString(16).substr(1)}`;
        }
    }

    const cssColor = cssColor2Hex(value);
    if (cssColor) {
        return cssColor;
    }

    return null;
}

export function normalizePaint(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const raw = String(value).trim();
    if (raw === '') {
        return null;
    }
    const lower = raw.toLowerCase();
    if (lower === 'none') {
        return 'none';
    }
    if (lower === 'inherit') {
        return 'inherit';
    }
    if (lower === 'currentcolor') {
        return 'currentColor';
    }
    if (lower.startsWith('url(')) {
        return null;
    }
    const hex = parseColor(raw);
    if (!hex || !hex.startsWith('#')) {
        return null;
    }
    return hex.toLowerCase();
}

export function parseDeclarations(text) {
    const result = {};
    if (!text) {
        return result;
    }
    const segments = String(text).split(';');
    for (const segment of segments) {
        const index = segment.indexOf(':');
        if (index === -1) {
            continue;
        }
        const key = segment.slice(0, index).trim();
        const value = segment.slice(index + 1).trim();
        if (key === 'fill' || key === 'stroke' || key === 'color') {
            result[key] = value;
        }
    }
    return result;
}

export function parseStyleSheet(css) {
    const rules = new Map();
    if (!css) {
        return rules;
    }
    const re = /\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;
    let match = re.exec(css);
    while (match) {
        const decls = parseDeclarations(match[2]);
        const existing = rules.get(match[1]) || {};
        rules.set(match[1], {
            ...existing,
            ...decls
        });
        match = re.exec(css);
    }
    return rules;
}

export function collectClassRules(node, rules = new Map()) {
    if (!node || typeof node !== 'object') {
        return rules;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            collectClassRules(child, rules);
        }
        return rules;
    }
    if (Array.isArray(node.style)) {
        for (const styleNode of node.style) {
            const css = styleSheetText(styleNode);
            if (css) {
                const parsed = parseStyleSheet(css);
                parsed.forEach((decls, className) => {
                    const existing = rules.get(className) || {};
                    rules.set(className, {
                        ...existing,
                        ...decls
                    });
                });
            }
        }
    }
    Object.keys(node).forEach((key) => {
        if (key === '$' || key === '_' || key === 'style') {
            return;
        }
        collectClassRules(node[key], rules);
    });
    return rules;
}

export function mergeClassDeclarations(classAttr, classRules) {
    const decls = {};
    if (!classAttr || !classRules) {
        return decls;
    }
    const names = String(classAttr).trim().split(/\s+/);
    for (const name of names) {
        const rule = classRules.get(name);
        if (rule) {
            Object.assign(decls, rule);
        }
    }
    return decls;
}

function applyPaintValue(current, raw) {
    if (raw === undefined || raw === null || raw === '') {
        return current;
    }
    const normalized = normalizePaint(raw);
    if (normalized === null) {
        return null;
    }
    if (normalized === 'inherit') {
        return current;
    }
    return normalized;
}

export function resolveElementPaint(parentPaint, presentation, classDecls, inlineDecls) {
    const parent = parentPaint || {};
    let fill = parent.fill !== undefined ? parent.fill : DEFAULT_FILL;
    let stroke = parent.stroke !== undefined ? parent.stroke : DEFAULT_STROKE;
    let color = parent.color !== undefined ? parent.color : DEFAULT_COLOR;

    fill = applyPaintValue(fill, presentation && presentation.fill);
    stroke = applyPaintValue(stroke, presentation && presentation.stroke);
    color = applyPaintValue(color, presentation && presentation.color);

    fill = applyPaintValue(fill, classDecls && classDecls.fill);
    stroke = applyPaintValue(stroke, classDecls && classDecls.stroke);
    color = applyPaintValue(color, classDecls && classDecls.color);

    fill = applyPaintValue(fill, inlineDecls && inlineDecls.fill);
    stroke = applyPaintValue(stroke, inlineDecls && inlineDecls.stroke);
    color = applyPaintValue(color, inlineDecls && inlineDecls.color);

    const resolvedColor = (color && color !== 'none' && color !== 'currentColor') ? color : DEFAULT_COLOR;
    if (fill === 'currentColor') {
        fill = resolvedColor;
    }
    if (stroke === 'currentColor') {
        stroke = resolvedColor;
    }
    if (color === 'currentColor') {
        color = DEFAULT_COLOR;
    }

    return {
        fill,
        stroke,
        color
    };
}

export function aggregateColorPalette(paints) {
    const counts = new Map();
    for (const paint of paints) {
        if (!paint) {
            continue;
        }
        for (const role of ['fill', 'stroke']) {
            const hex = paint[role];
            if (!hex || hex === 'none' || !String(hex).startsWith('#')) {
                continue;
            }
            const key = `${role}:${hex}`;
            const existing = counts.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                counts.set(key, {
                    role,
                    hex,
                    count: 1
                });
            }
        }
    }
    return Array.from(counts.values());
}

export function styleForMatchedPaint(paint, colorFilter) {
    const fillMatch = colorFilter.some(entry => entry && entry.role === 'fill' && paint && paint.fill === entry.hex);
    const strokeMatch = colorFilter.some(entry => entry && entry.role === 'stroke' && paint && paint.stroke === entry.hex);
    if (fillMatch && strokeMatch) {
        return FILTERED_BOTH_STYLE;
    }
    if (fillMatch) {
        return FILTERED_FILL_STYLE;
    }
    return OVERRIDE_STYLE;
}

export function matchesColorFilter(paint, colorFilter) {
    if (!paint || !colorFilter || colorFilter.length === 0) {
        return false;
    }
    return colorFilter.some((entry) => {
        if (!entry || !entry.hex || entry.hex === 'none') {
            return false;
        }
        if (entry.role === 'fill') {
            return paint.fill === entry.hex;
        }
        if (entry.role === 'stroke') {
            return paint.stroke === entry.hex;
        }
        return false;
    });
}

function isEmptyGroup(node) {
    if (!node || typeof node !== 'object') {
        return true;
    }
    return Object.keys(node).every(key => key === '$' || key === '_');
}

export function filterParsedNode(node, getPaint, colorFilter) {
    if (!node || typeof node !== 'object') {
        return node;
    }

    function filterChild(key, child) {
        if (GRAPHIC_TAGS.has(key)) {
            const paint = getPaint(child);
            if (!matchesColorFilter(paint, colorFilter)) {
                return null;
            }
            const filtered = filterParsedNode(child, getPaint, colorFilter);
            if (filtered && typeof filtered === 'object') {
                filtered.$ = {
                    ...(filtered.$ || {})
                };
                filtered.$.style = styleForMatchedPaint(paint, colorFilter);
            }
            return filtered;
        }
        const filtered = filterParsedNode(child, getPaint, colorFilter);
        if (key === 'g' && isEmptyGroup(filtered)) {
            return null;
        }
        return filtered;
    }

    const copy = {};
    if (node.$) {
        copy.$ = {
            ...node.$
        };
    }
    if (node._ !== undefined) {
        copy._ = node._;
    }
    Object.keys(node).forEach((key) => {
        if (key === '$' || key === '_') {
            return;
        }
        const value = node[key];
        if (Array.isArray(value)) {
            const children = value
                .map(child => filterChild(key, child))
                .filter(Boolean);
            if (children.length > 0) {
                copy[key] = children;
            }
            return;
        }
        if (value && typeof value === 'object') {
            const filtered = filterChild(key, value);
            if (filtered) {
                copy[key] = filtered;
            }
        }
    });
    return copy;
}

export function applyPaintToTree(resolvedPaint, node, paint) {
    if (!node || typeof node !== 'object' || !resolvedPaint) {
        return;
    }
    if (Array.isArray(node)) {
        for (const child of node) {
            applyPaintToTree(resolvedPaint, child, paint);
        }
        return;
    }
    resolvedPaint.set(node, paint);
    Object.keys(node).forEach((key) => {
        if (key === '$' || key === '_') {
            return;
        }
        applyPaintToTree(resolvedPaint, node[key], paint);
    });
}
