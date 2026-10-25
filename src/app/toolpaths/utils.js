import {
    HEAD_CNC, HEAD_LASER,
    PROCESS_MODE_BW,
    PROCESS_MODE_GREYSCALE,
    PROCESS_MODE_HALFTONE, PROCESS_MODE_MESH, PROCESS_MODE_VECTOR,
    TOOLPATH_TYPE_IMAGE, TOOLPATH_TYPE_SCULPT, TOOLPATH_TYPE_VECTOR
} from '../constants';
import i18n from '../lib/i18n';

const crossKeys = (...args) => {
    const _crossKeys = (param, keys, res) => {
        for (const key of keys) {
            if (param === '') {
                res.push(`${key}`);
            } else {
                res.push(`${param},${key}`);
            }
        }
    };

    let params = [''];
    let result = [''];

    for (const arg of args) {
        params = result;
        result = [];
        for (const param of params) {
            _crossKeys(param, arg, result);
        }
    }

    return result.map(v => v.split(','));
};

const toolPathTypeMap = new Map();

const setMap = (key, value) => {
    toolPathTypeMap.set(JSON.stringify(key), value);
};

const getMap = (key) => {
    return toolPathTypeMap.get(JSON.stringify(key));
};

crossKeys([PROCESS_MODE_BW, PROCESS_MODE_GREYSCALE, PROCESS_MODE_HALFTONE])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_IMAGE);
    });

crossKeys([PROCESS_MODE_VECTOR])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_VECTOR);
    });

crossKeys([PROCESS_MODE_MESH])
    .forEach(v => {
        setMap(v, TOOLPATH_TYPE_SCULPT);
    });


export const getToolPathType = (models) => {
    let types = models.map(v => getMap([v.mode]));
    types = Array.from(new Set(types));
    return types;
};

export const getModelColorPalette = (model) => {
    if (!model || model.mode !== PROCESS_MODE_VECTOR) {
        return null;
    }
    const palette = model.config && model.config.colorPalette;
    if (!Array.isArray(palette) || palette.length === 0) {
        return null;
    }
    return palette;
};

export const getToolPathColorPalette = (toolPath, models) => {
    if (!toolPath || toolPath.type !== TOOLPATH_TYPE_VECTOR) {
        return null;
    }
    const ids = toolPath.visibleModelIDs || [];
    if (ids.length !== 1 || !Array.isArray(models)) {
        return null;
    }
    const model = models.find(item => item.modelID === ids[0]);
    return getModelColorPalette(model);
};

export const isSameColorFilterEntry = (a, b) => {
    return a && b && a.role === b.role && a.hex === b.hex;
};

export const getModelsByToolPathType = (models) => {
    const types = getToolPathType(models);
    const modelObj = {};
    types.forEach((type) => {
        modelObj[type] = [];
    });
    models.forEach(v => {
        const eachType = getMap([v.mode]);
        if (modelObj[eachType]) {
            modelObj[eachType].push(v);
        }
    });
    return modelObj;
};

export const createToolPathNameByType = (count, type, headType) => {
    let baseName = i18n._('key-toolpath_basename-unknown');
    if (headType === HEAD_CNC) {
        if (type === 'vector') {
            baseName = i18n._('key-toolpath_basename-Vector Toolpath');
        } else {
            baseName = i18n._('key-toolpath_basename-Carve Toolpath');
        }
        return `${baseName} - ${count++}`;
    }
    if (headType === HEAD_LASER) {
        if (type === 'vector') {
            baseName = i18n._('key-toolpath_basename-Vector Toolpath');
        } else {
            baseName = i18n._('key-toolpath_basename-Image Toolpath');
        }
        return `${baseName} - ${count++}`;
    }
    return baseName;
};

export const IDLE = 'idle';
// eslint-disable-next-line no-unused-vars
export const RUNNING = 'running';
// eslint-disable-next-line no-unused-vars
export const FAILED = 'failed';
// eslint-disable-next-line no-unused-vars
export const SUCCESS = 'success';
// eslint-disable-next-line no-unused-vars
export const WARNING = 'warning';
