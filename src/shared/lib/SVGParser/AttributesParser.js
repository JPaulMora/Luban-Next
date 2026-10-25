import log from 'loglevel';
import { isUndefined } from 'lodash';
import { parseFloats, xformMultiply } from './Utils';
import { SVG_ATTR_ID, XLINK_HREF, SVG_ATTR_HREF, OVERRIDE_STYLE } from './constants';
import {
    GRAPHIC_TAGS,
    mergeClassDeclarations,
    parseColor,
    parseDeclarations,
    resolveElementPaint
} from './svgPaint';


function parseDAttribute(value) {
    const items = [];

    // const re = /([A-Za-z]|(-?\.?[0-9]+\.?[0-9]*(e-?[0-9]*)?))/g;
    // https://www.regular-expressions.info/floatingpoint.html
    const re = /([A-Za-z]|([+-]?[0-9]*\.?[0-9]+([Ee][+-]?[0-9]+)?))/g;
    let m = re.exec(value);
    while (m) {
        const f = parseFloat(m[1]);
        if (Number.isNaN(f)) {
            // command
            items.push(m[1]);
        } else {
            // number
            items.push(f);
        }
        m = re.exec(value);
    }

    return items;
}

function parseCoordinate(value, fontSizeValue) {
    // const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]*)?)(px|pt|pc|mm|cm|in|%|em|ex)?/;
    const re = /(-?[0-9]+\.?[0-9]*(e-?[0-9]+)?)(px|pt|pc|mm|cm|in|%|em|ex)?/;
    const m = re.exec(value);
    if (m) {
        const num = parseFloat(m[1]);
        const unit = m[3];
        const DPI = 72;
        switch (unit) {
            // Use DPI = 72 to calculate metrics
            case 'px':
                return num;
            case 'pt':
                return num / 72 * DPI;
            case 'pc':
                return num / 6 * DPI;

            // Map to mm metric
            case 'mm':
                return num;
            case 'cm':
                return num * 10;
            case 'in':
                return num * 25.4;

            case 'em':
                if (!(isUndefined(fontSizeValue))) {
                    return fontSizeValue * num;
                }
                // fontSize, dx, dy, x, y needed
                return num;
            // Not supported
            case 'ex':
                log.warn('No supported unit ex');
                // fontSize needed
                return num;
            case '%':
                // Need special treat outside of the function
                return num / 100.0;
            default:
                return num;
        }
    }

    return 0;
}

// function parsePaint(value) {
//     // https://www.w3.org/TR/SVG/painting.html#SpecifyingPaint
//     // <paint> = none | child | child(<integer>) | <color> | <url> [none | <color>]? | context-fill | context-stroke
//     if (value === 'none') {
//         return null;
//     }
//
//     // TODO
//     if (value.startsWith('url')) {
//         return null;
//     }
//
//     const color = parseColor(value);
//     if (color) {
//         return color;
//     }
//
//     // default value: black
//     return '#000000';
// }

function parseTransform(value) {
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform
    // <transform-list>
    // transform functions:
    // 1) matrix(a b c d e f)
    // 2) translate(x [y])
    // 3) scale(x [y])
    // 4) rotate(a [x y])
    // 5) skewX(a)
    // 6) skewY(a)

    const re = /([a-z]+)\s*\(([^)]*)\)/gi;

    const xform = [1, 0, 0, 1, 0, 0];
    let m = re.exec(value);
    while (m) {
        const func = m[1].toLowerCase();
        const params = parseFloats(m[2]);

        switch (func) {
            case 'matrix': {
                if (params.length === 6) {
                    xformMultiply(xform, params);
                }
                break;
            }
            case 'translate': {
                if (params.length === 1) {
                    params[1] = 0;
                }
                xformMultiply(xform, [1, 0, 0, 1, params[0], params[1]]);
                break;
            }
            case 'scale': {
                if (params.length === 1) {
                    params[1] = params[0];
                }
                xformMultiply(xform, [params[0], 0, 0, params[1], 0, 0]);
                break;
            }
            case 'rotate': {
                if (params.length === 1) {
                    params[1] = 0;
                    params[2] = 0;
                }
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, 0, 1, params[1], params[2]]);
                xformMultiply(xform, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
                xformMultiply(xform, [1, 0, 0, 1, -params[1], -params[2]]);
                break;
            }
            case 'skewx': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, 0, Math.tan(angle), 1, 0, 0]);
                break;
            }
            case 'skewy': {
                const angle = params[0] * Math.PI / 180;
                xformMultiply(xform, [1, Math.tan(angle), 0, 1, 0, 0]);
                break;
            }
            default: {
                log.warn(`Unknown transform function ${func}`);
                break;
            }
        }

        m = re.exec(value);
    }

    return xform;
}

class AttributesParser {
    constructor(parser) {
        this.parser = parser;
    }

    recordResolvedPaint(node, tag, paint) {
        if (!this.parser || !this.parser.resolvedPaint) {
            return;
        }
        this.parser.resolvedPaint.set(node, {
            fill: paint.fill,
            stroke: paint.stroke
        });
        if (GRAPHIC_TAGS.has(tag) && this.parser.graphicPaints) {
            this.parser.graphicPaints.push({
                fill: paint.fill,
                stroke: paint.stroke
            });
        }
    }

    parse(node, parentAttributes, tag) {
        const attributes = {};
        for (const key of ['fill', 'stroke', 'strokeWidth', 'visibility', 'width', 'height', 'fontFamily', 'dx', 'dy', 'fontSize']) {
            attributes[key] = parentAttributes[key];
        }
        // make a copy of parentAttributes
        attributes.xform = [1, 0, 0, 1, 0, 0];
        // Regardless of whether 'node.$' is exited, 'xform' in 'attributes' must be applied to 'node' element
        xformMultiply(attributes.xform, parentAttributes.xform);
        // Used for text
        if (node._) {
            // how to deal with '\\ntspan line 6' and '\n        tspan line 6\n    '
            attributes._ = (node._).trim();
        }

        const parentPaint = {
            fill: parentAttributes.resolvedFill,
            stroke: parentAttributes.resolvedStroke,
            color: parentAttributes.resolvedColor
        };

        if (!node.$) {
            const inheritedPaint = resolveElementPaint(parentPaint);
            attributes.resolvedFill = inheritedPaint.fill;
            attributes.resolvedStroke = inheritedPaint.stroke;
            attributes.resolvedColor = inheritedPaint.color;
            this.recordResolvedPaint(node, tag, inheritedPaint);
            return attributes;
        }
        let isTextElement = false;
        if (tag === 'text' || tag === 'tspan') {
            isTextElement = true;
        }

        const presentation = {
            fill: node.$.fill,
            stroke: node.$.stroke,
            color: node.$.color
        };
        const classDecls = mergeClassDeclarations(
            node.$.class,
            this.parser.classRules
        );
        const inlineDecls = parseDeclarations(node.$.style);
        const paint = resolveElementPaint(parentPaint, presentation, classDecls, inlineDecls);
        attributes.resolvedFill = paint.fill;
        attributes.resolvedStroke = paint.stroke;
        attributes.resolvedColor = paint.color;
        this.recordResolvedPaint(node, tag, paint);

        node.$.fill = 'none';
        Object.keys(node.$).forEach((key) => {
            const value = node.$[key];
            this.parseAttribute(attributes, parentAttributes, key, value, isTextElement);
        });

        if (!node.$.style) {
            node.$.style = OVERRIDE_STYLE;
        } else {
            node.$.style += `;${OVERRIDE_STYLE}`;
        }
        // make text have the right x
        if (isTextElement) {
            if ((isUndefined(attributes.x))) {
                attributes.actualX = parentAttributes.actualX;
            } else {
                attributes.actualX = attributes.x;
            }
            if ((isUndefined(attributes.y))) {
                attributes.actualY = parentAttributes.actualY;
            } else {
                attributes.actualY = attributes.y;
            }
        } else {
            attributes.actualX = 0;
            attributes.actualY = 0;
        }
        return attributes;
    }

    parseAttribute(attributes, parentAttributes, key, value, isTextElement) {
        if (isTextElement && key === 'font-family') {
            attributes.fontFamily = value.replace(/['"]+/g, '');
        }
        switch (key) {
            case 'font-size': {
                attributes.fontSize = parseCoordinate(value, parentAttributes.fontSize);
                if (value.endsWith('%')) {
                    // width & height
                    attributes[key] *= parentAttributes[key];
                }
                break;
            }
            case 'width':
            case 'height':
            case 'cx':
            case 'cy':
            case 'r':
            case 'rx':
            case 'ry':
            case 'x':
            case 'y':
            case 'x1':
            case 'y1':
            case 'x2':
            case 'y2':
            case 'dy':
            case 'dx': {
                attributes[key] = parseCoordinate(value, attributes.fontSize);
                if (value.endsWith('%')) {
                    // width & height
                    attributes[key] *= parentAttributes[key];
                }
                break;
            }
            // case 'stroke-width': {
            //     attributes.strokeWidth = parseCoordinate(value);
            //     break;
            // }
            case 'd': {
                attributes.d = parseDAttribute(value);
                break;
            }
            case 'color': {
                const color = parseColor(value);
                if (color && color !== 'inherit') {
                    attributes.color = color;
                }
                break;
            }
            // case 'fill':
            // case 'stroke': {
            //     const color = parsePaint(value);
            //     attributes[key] = color;
            //     break;
            // }
            case 'transform': {
                const xform = parseTransform(value);
                xformMultiply(attributes.xform, xform);
                break;
            }
            case 'style': {
                const segments = value.split(';');
                for (const segment of segments) {
                    const kv = segment.split(':');
                    if (kv.length === 2) {
                        const k = kv[0].trim();
                        const v = kv[1].trim();
                        this.parseAttribute(attributes, parentAttributes, k, v, isTextElement);
                    }
                }
                break;
            }
            case 'display': {
                if (value === 'none') {
                    attributes.visible = false;
                }
                break;
            }
            case 'visibility': {
                if (value !== 'inherit') {
                    attributes.visibility = (value === 'visible');
                }
                break;
            }
            case 'points': {
                attributes.points = parseFloats(value);
                break;
            }
            case 'viewBox': {
                attributes.viewBox = parseFloats(value);
                break;
            }
            case 'fill-rule': {
                attributes[key] = value;
                break;
            }
            case 'text-anchor': {
                attributes[key] = value;
                break;
            }
            case SVG_ATTR_ID: {
                attributes[key] = `#${value}`;
                break;
            }
            case XLINK_HREF:
            case SVG_ATTR_HREF: {
                attributes[key] = value;
                break;
            }
            default:
                break;
        }
    }
}

export default AttributesParser;
