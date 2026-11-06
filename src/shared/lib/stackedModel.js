/**
 * Stacked-model slicing settings.
 *
 * The slicer cuts planes of constant Z. Each up-axis map keeps the
 * historical Y flip used for Z-up, so a sheet's Y matches the laser
 * view. The chosen axis becomes +Z. The first slice is at the low end
 * of that axis, which is the base of the model.
 *
 * A tilt angle rotates that map from the up axis toward another axis.
 * Zero degrees leaves the map unchanged. The mesh is transformed before
 * slicing, and the slicer still cuts constant Z.
 */

const UP_AXES = {
    z: { x: 'x', y: '-y', z: 'z' },
    '-z': { x: 'x', y: '-y', z: '-z' },
    y: { x: 'x', y: '-z', z: 'y' },
    '-y': { x: 'x', y: 'z', z: '-y' },
    x: { x: 'z', y: '-y', z: 'x' },
    '-x': { x: '-z', y: '-y', z: '-x' }
};

export function upAxisCoordinate(upAxis) {
    return UP_AXES[upAxis] || UP_AXES.z;
}

function axisVector(axis) {
    const sign = String(axis)[0] === '-' ? -1 : 1;
    const name = String(axis).slice(-1);
    return {
        x: name === 'x' ? sign : 0,
        y: name === 'y' ? sign : 0,
        z: name === 'z' ? sign : 0
    };
}

function dot(a, b) {
    return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function cross(a, b) {
    return {
        x: (a.y * b.z) - (a.z * b.y),
        y: (a.z * b.x) - (a.x * b.z),
        z: (a.x * b.y) - (a.y * b.x)
    };
}

function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scaleVector(vector, scalar) {
    return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function rotateAround(vector, axis, radians) {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return add(
        add(scaleVector(vector, cosine), scaleVector(cross(axis, vector), sine)),
        scaleVector(axis, dot(axis, vector) * (1 - cosine))
    );
}

function frameFromAxis(upAxis) {
    const coordinate = upAxisCoordinate(upAxis);
    return {
        x: axisVector(coordinate.x),
        y: axisVector(coordinate.y),
        z: axisVector(coordinate.z)
    };
}

export function axesPerpendicular(upAxis, tiltAxis) {
    if (!UP_AXES[upAxis] || !UP_AXES[tiltAxis]) {
        return false;
    }
    return dot(axisVector(upAxis), axisVector(tiltAxis)) === 0;
}

// First of +X, +Y, +Z that is perpendicular to the up axis.
export function defaultTiltAxis(upAxis) {
    const from = axisVector(upAxis);
    if (from.x === 0) {
        return 'x';
    }
    if (from.y === 0) {
        return 'y';
    }
    return 'z';
}

// Rows are the output axes in original coordinates. new = frame * old.
export function stackFrame(upAxis, tiltAxis, tiltAngleDeg) {
    const base = frameFromAxis(upAxis);
    const angle = Number(tiltAngleDeg) || 0;
    if (!angle || !axesPerpendicular(upAxis, tiltAxis)) {
        return base;
    }
    const axis = cross(axisVector(upAxis), axisVector(tiltAxis));
    const radians = (angle * Math.PI) / 180;
    return {
        x: rotateAround(base.x, axis, radians),
        y: rotateAround(base.y, axis, radians),
        z: rotateAround(base.z, axis, radians)
    };
}

// Extent of an axis-aligned box along a direction.
export function projectedExtent(size, row) {
    return (Math.abs(Number(size.x) || 0) * Math.abs(row.x))
        + (Math.abs(Number(size.y) || 0) * Math.abs(row.y))
        + (Math.abs(Number(size.z) || 0) * Math.abs(row.z));
}

export function upAxisLayout(upAxis) {
    const coordinate = upAxisCoordinate(upAxis);
    return {
        x: coordinate.x.slice(-1),
        y: coordinate.y.slice(-1),
        z: coordinate.z.slice(-1)
    };
}

// Original-model axis that is stacked.
export function upAxisName(upAxis) {
    return upAxisLayout(upAxis).z;
}

// Largest original-axis size that still fits the bed and the stack limit.
export function limitsForUpAxis(upAxis, bedX, bedY, maxStack) {
    const layout = upAxisLayout(upAxis);
    const outputLimit = { x: bedX, y: bedY, z: maxStack };
    const limit = { x: 0, y: 0, z: 0 };
    Object.keys(layout).forEach((outputAxis) => {
        limit[layout[outputAxis]] = outputLimit[outputAxis];
    });
    return limit;
}

export function normalizeStackSettings(settings = {}) {
    const upAxis = Object.prototype.hasOwnProperty.call(UP_AXES, settings.upAxis)
        ? settings.upAxis
        : 'z';
    const modelOffset = Math.max(0, Number(settings.modelOffset) || 0);
    const layersOn = Math.max(1, Math.floor(Number(settings.layersOn)) || 1);
    const layersOff = Math.max(0, Math.floor(Number(settings.layersOff)) || 0);
    const tiltAngle = Math.min(90, Math.max(0, Number(settings.tiltAngle) || 0));
    const tiltAxis = axesPerpendicular(upAxis, settings.tiltAxis)
        ? settings.tiltAxis
        : defaultTiltAxis(upAxis);
    return {
        upAxis,
        modelOffset,
        layersOn,
        layersOff,
        tiltAxis,
        tiltAngle
    };
}

// index 0 is the first slice above the offset. layersOff 0 keeps every layer.
export function layerIsKept(index, layersOn, layersOff) {
    const on = Math.max(1, Math.floor(Number(layersOn)) || 1);
    const off = Math.max(0, Math.floor(Number(layersOff)) || 0);
    if (off === 0) {
        return true;
    }
    return (index % (on + off)) < on;
}

export function sliceLayerCount(lengthZ, thickness, zStart = 0) {
    const layerThickness = Number(thickness);
    const start = Math.max(0, Number(zStart) || 0);
    if (!Number.isFinite(lengthZ) || !Number.isFinite(layerThickness) || layerThickness <= 0) {
        return 0;
    }
    const baseInitial = layerThickness / 2;
    const available = lengthZ - start;
    if (available < baseInitial) {
        return 0;
    }
    return Math.floor((available - baseInitial) / layerThickness) + 1;
}
