import {
    conventionalRings,
    differencePaths,
    finestGap,
    offsetPaths,
    pathsArea,
} from './geometry';
import { parseGerber } from './parseGerber';

const NARROW_AREA = 0.02;
const FRAME_MARGIN = 5;

const boundsOf = (paths) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    paths.forEach((ring) => {
        ring.forEach((point) => {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        });
    });
    return { minX, minY, maxX, maxY };
};

/**
 * FlatCAM isolate, pass 0.
 *
 * The tool centerline is the boundary of the copper offset by the cutting
 * radius. That line is the center of the band the bit actually removes:
 * the band runs from the copper edge out to one cutting diameter.
 * Gaps narrower than that diameter close up under the offset; those are
 * details the bit cannot isolate without cutting the copper.
 */
const isolateCopper = (paths, diameter) => {
    const radius = diameter / 2;
    const centerlinePaths = offsetPaths(paths, radius, false);
    const closed = offsetPaths(centerlinePaths, -radius, false);
    const blocked = differencePaths(closed, paths);
    const removal = differencePaths(offsetPaths(paths, diameter, false), paths);
    return {
        centerlines: conventionalRings(centerlinePaths),
        removal,
        narrow: pathsArea(blocked) > NARROW_AREA,
        blockedArea: pathsArea(blocked),
    };
};

const frameFor = (paths, margin = FRAME_MARGIN) => {
    const bounds = boundsOf(paths);
    return {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY,
        margin,
        width: (bounds.maxX - bounds.minX) + (2 * margin),
        height: (bounds.maxY - bounds.minY) + (2 * margin),
    };
};

const toSvgPoint = (point, frame) => ([
    (point[0] - frame.minX) + frame.margin,
    (frame.maxY - point[1]) + frame.margin,
]);

const ringPath = (ring, frame) => {
    const parts = ['M'];
    ring.forEach((point) => {
        const [x, y] = toSvgPoint(point, frame);
        parts.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
    });
    parts.push('Z');
    return parts.join(' ');
};

const svgDocument = (body, frame) => (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}mm" height="${frame.height}mm" `
    + `viewBox="0 0 ${frame.width} ${frame.height}">${body}</svg>`
);

// The canvas shows the copper. A removal-band picture draws every pad and
// teardrop as a hole in the cut, which is the copper itself.
const copperSvg = (paths, frame) => {
    const d = paths.map((ring) => ringPath(ring, frame)).join(' ');
    const body = `<path fill="#C47B2B" fill-opacity="0.9" stroke="#6B3E12" stroke-width="0.05" fill-rule="nonzero" d="${d}"/>`;
    return svgDocument(body, frame);
};

const centerlineSvg = (centerlines, frame) => {
    const body = centerlines.map((ring) => (
        `<path fill="none" stroke="#000" stroke-width="0.2" d="${ringPath(ring, frame)}"/>`
    )).join('');
    return svgDocument(body, frame);
};

const warningText = (diameter, depth) => {
    const width = diameter.toFixed(2);
    const cutDepth = Number(depth).toFixed(2);
    return `${width} mm is the cutting width at ${cutDepth} mm depth. `
        + 'Some gaps are narrower than that, so the bit cannot isolate them without cutting the copper.';
};

const importGerber = (text) => {
    const parsed = parseGerber(text);
    if (!parsed.paths.length) {
        throw new Error('No copper geometry found in the Gerber file.');
    }
    const frame = frameFor(parsed.paths);
    const warnings = [];
    if (parsed.skippedMacros > 0) {
        warnings.push('Aperture macros were skipped. Pads that use them are missing from the copper.');
    }
    return {
        svg: copperSvg(parsed.paths, frame),
        copper: {
            paths: parsed.paths,
            frame,
            width: frame.width,
            height: frame.height,
        },
        warnings,
        width: frame.width,
        height: frame.height,
        finestGap: finestGap(parsed.paths),
    };
};

const centerlineFromCopper = (copper, diameter) => {
    const isolated = isolateCopper(copper.paths, diameter);
    return {
        svg: centerlineSvg(isolated.centerlines, copper.frame),
        narrow: isolated.narrow,
        diameter,
    };
};

export {
    isolateCopper,
    importGerber,
    centerlineFromCopper,
    warningText,
};
