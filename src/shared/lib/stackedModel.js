/**
 * Stacked-model slicing settings.
 *
 * The slicer cuts planes of constant Z. Each up-axis map is right-handed
 * and keeps the historical Y flip used for Z-up, so a sheet's Y matches
 * the laser view. The chosen axis becomes +Z. The first slice is at the
 * low end of that axis, which is the base of the model.
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
    return {
        upAxis,
        modelOffset,
        layersOn,
        layersOff
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
