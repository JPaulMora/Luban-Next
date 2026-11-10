export type CncToolParams = {
    definitionId?: string;
    definitionName?: string;
    toolType?: string;
    toolDiameter?: number;
    toolAngle?: number;
    toolShaftDiameter?: number;
    toolChangeZOffset?: number;
};

export type CncToolChangeToolPath = {
    toolParams?: CncToolParams;
    gcodeConfig?: {
        jogSpeed?: number;
    };
    materials?: {
        isRotate?: boolean;
    };
};

const TOOL_COMPARE_KEYS: Array<keyof CncToolParams> = [
    'definitionId',
    'toolType',
    'toolDiameter',
    'toolAngle',
    'toolShaftDiameter',
];

const DEFAULT_JOG_SPEED = 1500;
// After Resume the head is often at stop height (~80 mm). Feed the whole
// descent at F100 would take tens of seconds. Rapid to a short clearance,
// then feed only the last millimetres to the new zero.
const APPROACH_CLEARANCE_MM = 5;
const TOUCH_FEED_MM_MIN = 300;

function normalizeCompareValue(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return '';
        }
        return String(value);
    }
    return String(value);
}

/**
 * True when two consecutive CNC toolpaths use a different bit.
 * Empty toolParams on both sides counts as the same tool.
 */
export function cncToolsDiffer(
    previous: CncToolParams | undefined | null,
    next: CncToolParams | undefined | null
): boolean {
    const a = previous || {};
    const b = next || {};
    const aEmpty = TOOL_COMPARE_KEYS.every((key) => normalizeCompareValue(a[key]) === '');
    const bEmpty = TOOL_COMPARE_KEYS.every((key) => normalizeCompareValue(b[key]) === '');
    if (aEmpty && bEmpty) {
        return false;
    }
    return TOOL_COMPARE_KEYS.some(
        (key) => normalizeCompareValue(a[key]) !== normalizeCompareValue(b[key])
    );
}

export function resolveToolChangeZOffset(toolParams?: CncToolParams | null): number {
    const raw = toolParams?.toolChangeZOffset;
    if (raw === undefined || raw === null) {
        return 0;
    }
    const value = Number(raw);
    if (Number.isNaN(value)) {
        return 0;
    }
    return value;
}

function formatOffset(offset: number): string {
    if (Number.isInteger(offset)) {
        return String(offset);
    }
    return String(Number(offset.toFixed(3)));
}

function toolLabel(toolParams?: CncToolParams | null): string {
    const name = toolParams?.definitionName;
    if (typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
    }
    const id = toolParams?.definitionId;
    if (typeof id === 'string' && id.trim().length > 0) {
        return id.trim();
    }
    return 'tool';
}

/**
 * G-code inserted between two CNC toolpaths that use different bits.
 * Throws when either path is rotary: there is no 3-axis work Z to touch off.
 */
export function buildCncToolChangeLines(
    previous: CncToolChangeToolPath,
    next: CncToolChangeToolPath
): string[] {
    if (!cncToolsDiffer(previous?.toolParams, next?.toolParams)) {
        return [];
    }
    if (previous?.materials?.isRotate || next?.materials?.isRotate) {
        throw new Error('CNC tool change is not supported on a rotary job.');
    }

    const offset = resolveToolChangeZOffset(next?.toolParams);
    const jogSpeed = Number(previous?.gcodeConfig?.jogSpeed);
    const feed = Number.isFinite(jogSpeed) && jogSpeed > 0 ? jogSpeed : DEFAULT_JOG_SPEED;
    const fromName = toolLabel(previous?.toolParams);
    const toName = toolLabel(next?.toolParams);
    const offsetText = formatOffset(offset);
    const approachText = formatOffset(offset + APPROACH_CLEARANCE_MM);

    return [
        `; Tool change: ${fromName} -> ${toName}`,
        `; Z offset ${offsetText} mm. Positive means the new tool is longer.`,
        'M600',
        `G0 X0 Y0 F${feed}`,
        `G0 Z${approachText} F${feed}`,
        `G1 Z${offsetText} F${TOUCH_FEED_MM_MIN}`,
        'M600',
        'G92 Z0',
    ];
}
