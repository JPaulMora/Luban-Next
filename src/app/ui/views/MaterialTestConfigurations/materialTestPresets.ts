import { HEAD_LASER } from '../../../constants/machines';
import {
    L20WLaserToolModule,
    L2WLaserToolModule,
    L40WLaserToolModule,
    LEVEL_ONE_POWER_LASER_FOR_SM2,
    LEVEL_TWO_POWER_LASER_FOR_SM2,
} from '../../../machines/snapmaker-2-toolheads';
import {
    LEVEL_ONE_POWER_LASER_FOR_ORIGINAL,
    LEVEL_TWO_POWER_LASER_FOR_ORIGINAL,
} from '../../../machines/snapmaker-original-toolheads';

export type MaterialTestPresetId = 'engrave' | 'cut';

export interface MaterialTestRange {
    speedMin: number;
    speedMax: number;
    powerMin: number;
    powerMax: number;
}

export interface MaterialTestPreset {
    id: MaterialTestPresetId;
    labelKey: string;
    range: MaterialTestRange;
}

export const MATERIAL_TEST_GRID_DEFAULTS = {
    rectRows: 5,
    rectCols: 5,
    rectHeight: 5,
    rectWidth: 5,
    rectRowGap: 6,
    rectColGap: 6,
};

const ENGRAVE_LABEL = 'key_ui-views-MaterialTestModal-FormComponent-engrave';
const CUT_LABEL = 'key_ui-views-MaterialTestModal-FormComponent-cut';

function preset(id: MaterialTestPresetId, speedMin: number, speedMax: number, powerMin: number, powerMax: number): MaterialTestPreset {
    return {
        id,
        labelKey: id === 'engrave' ? ENGRAVE_LABEL : CUT_LABEL,
        range: {
            speedMin,
            speedMax,
            powerMin,
            powerMax,
        },
    };
}

const PRESETS_BY_TOOLHEAD: Record<string, MaterialTestPreset[]> = {
    [LEVEL_ONE_POWER_LASER_FOR_ORIGINAL]: [
        preset('engrave', 80, 600, 40, 100),
    ],
    [LEVEL_TWO_POWER_LASER_FOR_ORIGINAL]: [
        preset('engrave', 200, 1800, 20, 100),
        preset('cut', 80, 400, 60, 100),
    ],
    [LEVEL_ONE_POWER_LASER_FOR_SM2]: [
        preset('engrave', 200, 1800, 20, 100),
        preset('cut', 80, 400, 60, 100),
    ],
    [LEVEL_TWO_POWER_LASER_FOR_SM2]: [
        preset('engrave', 1000, 8000, 10, 80),
        preset('cut', 100, 800, 50, 100),
    ],
    [L20WLaserToolModule.identifier]: [
        preset('engrave', 2000, 14000, 10, 60),
        preset('cut', 200, 1500, 40, 90),
    ],
    [L40WLaserToolModule.identifier]: [
        preset('engrave', 4000, 20000, 8, 40),
        preset('cut', 300, 2000, 30, 80),
    ],
    [L2WLaserToolModule.identifier]: [
        preset('engrave', 200, 3000, 30, 100),
    ],
};

const FALLBACK_TOOLHEAD = LEVEL_TWO_POWER_LASER_FOR_SM2;

export function getMaterialTestPresets(toolhead: string): MaterialTestPreset[] {
    return PRESETS_BY_TOOLHEAD[toolhead] || PRESETS_BY_TOOLHEAD[FALLBACK_TOOLHEAD];
}

export function getMaterialTestPreset(toolhead: string, presetId: MaterialTestPresetId): MaterialTestPreset {
    const presets = getMaterialTestPresets(toolhead);
    return presets.find((item) => item.id === presetId) || presets[0];
}

export function materialTestStorageKey(toolhead: string): string {
    return `${HEAD_LASER}LastMaterialTest:${toolhead || 'unknown'}`;
}

function numericFields(record: Record<string, unknown>): Record<string, number> {
    return Object.fromEntries(
        Object.entries(record)
            .filter(([key, value]) => key !== 'preset' && Number.isFinite(Number(value)) && value !== '' && value !== null)
            .map(([key, value]) => [key, Number(value)])
    );
}

export function initialMaterialTestForm(toolhead: string, savedRaw: string | null): {
    preset: MaterialTestPresetId;
    values: Record<string, number>;
} {
    const presets = getMaterialTestPresets(toolhead);
    const fallback = presets[0];
    if (!savedRaw) {
        return {
            preset: fallback.id,
            values: {
                ...MATERIAL_TEST_GRID_DEFAULTS,
                ...fallback.range,
            },
        };
    }

    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(savedRaw);
    } catch {
        parsed = {};
    }
    const savedPreset = presets.find((item) => item.id === parsed.preset) || fallback;
    return {
        preset: savedPreset.id,
        values: {
            ...MATERIAL_TEST_GRID_DEFAULTS,
            ...savedPreset.range,
            ...numericFields(parsed),
        },
    };
}
