import {
    circlePoints,
    differencePaths,
    obroundPoints,
    offsetPaths,
    rectanglePoints,
    regularPolygon,
    sweepShape,
    unionPaths,
    withOrientation,
} from './geometry';

const STEPS_PER_CIRCLE = 40;

const wordPattern = () => /([XYIJD])([+-]?(?:\d+\.\d+|\.\d+|\d+))/g;

const parseGerberNumber = (token, fracDigits) => {
    if (token == null || token === '') {
        return null;
    }
    if (token.indexOf('.') !== -1) {
        return parseFloat(token);
    }
    return parseInt(token, 10) * (10 ** (-fracDigits));
};

// FlatCAM camlib.arc: chords of a circular interpolation.
const arcPoints = (center, radius, start, stop, direction) => {
    let end = stop;
    if (direction === 'ccw' && end <= start) {
        end += 2 * Math.PI;
    }
    if (direction === 'cw' && end >= start) {
        end -= 2 * Math.PI;
    }
    const angle = Math.abs(end - start);
    const steps = Math.max(Math.ceil((angle / (2 * Math.PI)) * STEPS_PER_CIRCLE), 2);
    const delta = (direction === 'ccw' ? 1 : -1) * (angle / steps);
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
        const theta = start + (delta * i);
        points.push([
            center[0] + (radius * Math.cos(theta)),
            center[1] + (radius * Math.sin(theta)),
        ]);
    }
    return points;
};

const arcSweep = (startAngle, stopAngle, direction) => {
    let stop = stopAngle;
    if (direction === 'ccw' && stop <= startAngle) {
        stop += 2 * Math.PI;
    }
    if (direction === 'cw' && stop >= startAngle) {
        stop -= 2 * Math.PI;
    }
    return Math.abs(stop - startAngle);
};

const splitStatements = (text) => {
    const statements = [];
    String(text).split(/\r?\n/).forEach((raw) => {
        let line = raw.trim();
        while (line.length > 0) {
            if (line.endsWith('%')) {
                statements.push(line);
                line = '';
            } else {
                const star = line.indexOf('*');
                if (star === -1) {
                    statements.push(line);
                    line = '';
                } else {
                    statements.push(line.slice(0, star + 1));
                    line = line.slice(star + 1).trim();
                }
            }
        }
    });
    return statements;
};

const apertureShape = (aperture) => {
    if (!aperture) {
        return null;
    }
    if (aperture.type === 'R') {
        return rectanglePoints(0, 0, aperture.width, aperture.height);
    }
    if (aperture.type === 'O') {
        return obroundPoints(0, 0, aperture.width, aperture.height);
    }
    if (aperture.type === 'P') {
        return regularPolygon(0, 0, aperture.diam, aperture.nVertices, aperture.rotation || 0);
    }
    return null;
};

const flashPoints = (x, y, aperture) => {
    if (!aperture) {
        return null;
    }
    if (aperture.type === 'C') {
        return circlePoints(x, y, aperture.size / 2);
    }
    if (aperture.type === 'R') {
        return rectanglePoints(x, y, aperture.width, aperture.height);
    }
    if (aperture.type === 'O') {
        return obroundPoints(x, y, aperture.width, aperture.height);
    }
    if (aperture.type === 'P') {
        return regularPolygon(x, y, aperture.diam, aperture.nVertices, aperture.rotation || 0);
    }
    return null;
};

const realizeRecord = (record, apertures) => {
    if (record.type === 'fill') {
        const ring = withOrientation(record.points, true);
        return ring ? [ring] : [];
    }
    const aperture = apertures[record.apertureId];
    if (!aperture) {
        return [];
    }
    if (aperture.type === 'C') {
        return offsetPaths([record.points], aperture.size / 2, true);
    }
    const shape = apertureShape(aperture);
    if (!shape) {
        return [];
    }
    const swept = sweepShape(record.points, shape);
    if (swept.length) {
        return swept;
    }
    const fallback = Math.min(aperture.width || aperture.diam || 0, aperture.height || aperture.diam || 0);
    if (fallback > 0) {
        return offsetPaths([record.points], fallback / 2, true);
    }
    return [];
};

class GerberParser {
    constructor() {
        this.fracDigits = 4;
        // FlatCAM treats an unspecified file as inches.
        this.toMm = 25.4;
        this.apertures = {};
        this.records = [];
        this.solid = [];
        this.path = [];
        this.currentX = null;
        this.currentY = null;
        this.currentAperture = null;
        this.lastAperture = null;
        this.operation = null;
        this.quadrant = null;
        this.polarity = 'D';
        this.makingRegion = false;
        this.inMacro = false;
        this.skippedMacros = 0;
        this.line = '';
    }

    scalePoint(point, factor) {
        return [point[0] * factor, point[1] * factor];
    }

    scaleStored(factor) {
        if (factor === 1) {
            return;
        }
        this.records = this.records.map((record) => ({
            ...record,
            points: record.points.map((point) => this.scalePoint(point, factor)),
        }));
        this.path = this.path.map((point) => this.scalePoint(point, factor));
        this.solid = this.solid.map((ring) => ring.map((point) => this.scalePoint(point, factor)));
        if (this.currentX != null) {
            this.currentX *= factor;
            this.currentY *= factor;
        }
        const next = {};
        Object.keys(this.apertures).forEach((id) => {
            const aperture = this.apertures[id];
            next[id] = {
                ...aperture,
                size: aperture.size != null ? aperture.size * factor : aperture.size,
                width: aperture.width != null ? aperture.width * factor : aperture.width,
                height: aperture.height != null ? aperture.height * factor : aperture.height,
                diam: aperture.diam != null ? aperture.diam * factor : aperture.diam,
            };
        });
        this.apertures = next;
    }

    setUnits(isInch) {
        const next = isInch ? 25.4 : 1;
        if (next === this.toMm) {
            return;
        }
        this.scaleStored(next / this.toMm);
        this.toMm = next;
    }

    coord(token) {
        const value = parseGerberNumber(token, this.fracDigits);
        if (value == null || Number.isNaN(value)) {
            return null;
        }
        return value * this.toMm;
    }

    addRecord(record) {
        this.records.push(record);
    }

    commitLayer() {
        const pieces = this.records.map((record) => realizeRecord(record, this.apertures));
        const united = unionPaths(pieces);
        if (this.polarity === 'D') {
            this.solid = unionPaths([this.solid, united]);
        } else if (united.length) {
            this.solid = differencePaths(this.solid, united);
        }
        this.records = [];
    }

    flushStroke() {
        if (this.path.length > 1 && !this.makingRegion && this.apertures[this.lastAperture]) {
            this.addRecord({
                type: 'stroke',
                points: this.path.slice(),
                apertureId: this.lastAperture,
            });
        }
        if (this.path.length > 2 && this.makingRegion) {
            this.addRecord({
                type: 'fill',
                points: this.path.slice(),
            });
        }
        if (this.currentX != null && this.currentY != null) {
            this.path = [[this.currentX, this.currentY]];
        } else {
            this.path = [];
        }
    }

    appendDraw(x, y) {
        this.path.push([x, y]);
        this.lastAperture = this.currentAperture;
    }

    readWords(line) {
        const body = line.endsWith('*') ? line.slice(0, -1) : line;
        const lead = body.match(/^G0?(\d+)/);
        const rest = lead ? body.slice(lead[0].length) : body;
        const words = {};
        if (lead) {
            words.G = parseInt(lead[1], 10);
        }
        const found = rest.match(wordPattern()) || [];
        found.forEach((token) => {
            words[token[0]] = token.slice(1);
        });
        return words;
    }

    operationFrom(words) {
        if (words.D == null) {
            return null;
        }
        const code = parseInt(words.D, 10);
        if (code >= 1 && code <= 3) {
            return code;
        }
        return null;
    }

    moveTo(words) {
        const x = words.X != null ? this.coord(words.X) : this.currentX;
        const y = words.Y != null ? this.coord(words.Y) : this.currentY;
        const operation = this.operationFrom(words);
        if (operation != null) {
            this.operation = operation;
        }
        if (words.G === 1 || words.G === 2 || words.G === 3) {
            this.interpolation = words.G;
        }
        return { x, y };
    }

    linear(words) {
        const { x, y } = this.moveTo(words);
        if (x == null || y == null) {
            return;
        }
        if (this.operation === 1) {
            this.currentX = x;
            this.currentY = y;
            this.appendDraw(x, y);
        } else if (this.operation === 2) {
            this.flushStroke();
            this.currentX = x;
            this.currentY = y;
            this.path = [[x, y]];
        } else if (this.operation === 3) {
            if (this.path.length > 1) {
                this.flushStroke();
            }
            this.currentX = x;
            this.currentY = y;
            this.path = [[x, y]];
            const points = flashPoints(x, y, this.apertures[this.currentAperture]);
            if (points) {
                this.addRecord({ type: 'fill', points });
            }
        }
    }

    circular(words) {
        const { x, y } = this.moveTo(words);
        const i = words.I != null ? this.coord(words.I) : 0;
        const j = words.J != null ? this.coord(words.J) : 0;
        const quadrant = this.quadrant || 'MULTI';
        const notAnArc = this.interpolation !== 2 && this.interpolation !== 3;
        if (this.operation === 2 || notAnArc || x == null || y == null) {
            this.currentX = x;
            this.currentY = y;
            this.flushStroke();
            if (x != null && y != null) {
                this.path = [[x, y]];
            }
            return;
        }
        const direction = this.interpolation === 2 ? 'cw' : 'ccw';
        let center = null;
        if (quadrant === 'MULTI') {
            center = [this.currentX + i, this.currentY + j];
        } else {
            const candidates = [
                [this.currentX + i, this.currentY + j],
                [this.currentX - i, this.currentY + j],
                [this.currentX + i, this.currentY - j],
                [this.currentX - i, this.currentY - j],
            ];
            const radius = Math.hypot(i, j);
            candidates.forEach((candidate) => {
                if (center) {
                    return;
                }
                const radius2 = Math.hypot(candidate[0] - x, candidate[1] - y);
                if (radius2 < radius * 0.95 || radius2 > radius * 1.05) {
                    return;
                }
                const start = Math.atan2(-(candidate[1] - this.currentY), -(candidate[0] - this.currentX));
                const stop = Math.atan2(-candidate[1] + y, -candidate[0] + x);
                if (arcSweep(start, stop, direction) <= ((Math.PI + 1e-6) / 2)) {
                    center = candidate;
                }
            });
        }
        if (!center || this.currentX == null) {
            this.currentX = x;
            this.currentY = y;
            return;
        }
        const radius = Math.hypot(center[0] - this.currentX, center[1] - this.currentY);
        const start = Math.atan2(-(center[1] - this.currentY), -(center[0] - this.currentX));
        const stop = (this.currentX === x && this.currentY === y)
            ? start
            : Math.atan2(-center[1] + y, -center[0] + x);
        const chord = arcPoints(center, radius, start, stop, direction);
        chord[chord.length - 1] = [x, y];
        chord.forEach((point) => {
            this.path.push(point);
        });
        this.currentX = x;
        this.currentY = y;
        this.lastAperture = this.currentAperture;
    }

    defineAperture(match) {
        const id = String(parseInt(match[1], 10));
        const kind = match[2];
        // Aperture modifiers are plain decimals, not FS coordinate words.
        // Vertex count and rotation are not lengths.
        const parts = match[3] ? match[3].split('X') : [];
        const lengthAt = (index) => parseFloat(parts[index]) * this.toMm;
        if (kind === 'C') {
            this.apertures[id] = { type: 'C', size: lengthAt(0) };
        } else if (kind === 'R') {
            const width = lengthAt(0);
            const height = lengthAt(1);
            this.apertures[id] = { type: 'R', width, height, size: Math.min(width, height) };
        } else if (kind === 'O') {
            const width = lengthAt(0);
            const height = lengthAt(1);
            this.apertures[id] = { type: 'O', width, height, size: Math.min(width, height) };
        } else if (kind === 'P') {
            const diam = lengthAt(0);
            this.apertures[id] = {
                type: 'P',
                diam,
                nVertices: parseInt(parts[1], 10),
                rotation: parts[2] != null ? parseFloat(parts[2]) : 0,
                size: diam,
            };
        } else {
            this.skippedMacros += 1;
        }
    }

    handle(line) {
        if (this.inMacro) {
            if (line.endsWith('%')) {
                this.inMacro = false;
            }
            return true;
        }
        const macro = line.match(/^%AM([^%*]+)\*/);
        if (macro) {
            this.skippedMacros += 1;
            this.inMacro = !line.endsWith('%');
            return true;
        }
        if (/[XYIJD]/.test(line) && !line.startsWith('%') && !line.startsWith('G04') && !line.startsWith('G4')) {
            const words = this.readWords(line);
            const hasArc = words.I != null || words.J != null || words.G === 2 || words.G === 3;
            const hasDraw = words.X != null || words.Y != null;
            if (hasArc && hasDraw) {
                this.circular(words);
                return true;
            }
            if (hasDraw) {
                this.linear(words);
                return true;
            }
        }
        const opcode = line.match(/^D0?([123])\*$/);
        if (opcode) {
            this.operation = parseInt(opcode[1], 10);
            if (this.operation === 3 && this.currentX != null) {
                const points = flashPoints(this.currentX, this.currentY, this.apertures[this.currentAperture]);
                if (points) {
                    this.addRecord({ type: 'fill', points });
                }
            }
            return true;
        }
        const quadrant = line.match(/^G7([45])\*$/);
        if (quadrant) {
            this.quadrant = quadrant[1] === '4' ? 'SINGLE' : 'MULTI';
            return true;
        }
        if (line === 'G36*') {
            this.flushStroke();
            this.makingRegion = true;
            return true;
        }
        if (line === 'G37*') {
            this.makingRegion = false;
            if (this.path.length >= 3) {
                this.addRecord({ type: 'fill', points: this.path.slice() });
            }
            if (this.currentX != null) {
                this.path = [[this.currentX, this.currentY]];
            }
            return true;
        }
        const aperture = line.match(/^%ADD(\d+)([a-zA-Z_$.][a-zA-Z0-9_$.-]*)(?:,(.*))?\*%$/);
        if (aperture) {
            this.defineAperture(aperture);
            return true;
        }
        const interpolation = line.match(/^(?:G0?([123]))\*$/);
        if (interpolation) {
            this.interpolation = parseInt(interpolation[1], 10);
            return true;
        }
        const tool = line.match(/^(?:G54)?D(\d{2,})\*$/);
        if (tool) {
            const next = String(parseInt(tool[1], 10));
            if (this.path.length > 1) {
                this.flushStroke();
            }
            this.currentAperture = next;
            return true;
        }
        const polarity = line.match(/^%LP([DC])\*%$/);
        if (polarity) {
            if (this.path.length > 1) {
                this.flushStroke();
            }
            if (polarity[1] !== this.polarity) {
                this.commitLayer();
                this.polarity = polarity[1];
            }
            return true;
        }
        const format = line.match(/^%FS([LT])([AI])X(\d)(\d)Y\d\d\*%$/);
        if (format) {
            this.fracDigits = parseInt(format[4], 10);
            return true;
        }
        const mode = line.match(/^%MO(IN|MM)\*%$/i);
        if (mode) {
            this.setUnits(mode[1].toUpperCase() === 'IN');
            return true;
        }
        const legacyUnits = line.match(/^G7([01])\*$/);
        if (legacyUnits) {
            this.setUnits(legacyUnits[1] === '0');
            return true;
        }
        if (/^G0?4/.test(line) || line === 'M02*' || line.startsWith('%')) {
            return true;
        }
        return false;
    }

    parse(text) {
        splitStatements(text).forEach((statement) => {
            this.line = statement;
            try {
                this.handle(statement);
            } catch (err) {
                throw new Error(`Gerber parse failed at "${statement}": ${err.message}`);
            }
        });
        this.flushStroke();
        this.commitLayer();
        return {
            paths: this.solid,
            skippedMacros: this.skippedMacros,
        };
    }
}

const parseGerber = (text) => new GerberParser().parse(text);

export {
    parseGerber,
    parseGerberNumber,
    arcPoints,
};
