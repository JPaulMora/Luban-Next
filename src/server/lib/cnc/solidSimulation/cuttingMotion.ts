import type { ToolCommand, Vec3 } from './types';

/** Tip Z within this (mm) counts as the same pass — avoids float/noise splits. */
export const DEFAULT_Z_EPS = 0.05;

export type MotionOptions = {
    zEpsilon?: number;
    stockTopZ?: number;
};

export type MachineState = {
    g: number;
    x: number;
    y: number;
    z: number;
    spindleOn: boolean;
};

export type CuttingMove = {
    prev: Vec3;
    next: Vec3;
    /** Quantized Z of the destination (and of prev when same-Z). */
    zQ: number;
    prevZQ: number;
    sameZ: boolean;
    /** 1-based G-code command index in the input list. */
    line: number;
    /** Total commands in the input list. */
    lineTotal: number;
};

export function applyCommand(state: MachineState, cmd: ToolCommand): MachineState {
    const next = { ...state };
    if (cmd.M === 3) {
        next.spindleOn = true;
    }
    if (cmd.M === 5) {
        next.spindleOn = false;
    }
    if (cmd.G === 0 || cmd.G === 1) {
        next.g = cmd.G;
    }
    if (cmd.X !== undefined) next.x = cmd.X;
    if (cmd.Y !== undefined) next.y = cmd.Y;
    if (cmd.Z !== undefined) next.z = cmd.Z;
    return next;
}

export function sameZ(a: number, b: number, eps: number): boolean {
    return Math.abs(a - b) <= eps;
}

export function quantizeZ(z: number, eps: number): number {
    if (eps <= 0) {
        return z;
    }
    return Math.round(z / eps) * eps;
}

export function isCuttingMove(state: MachineState, stockTopZ: number): boolean {
    return state.g === 1 && state.spindleOn && state.z <= stockTopZ + DEFAULT_Z_EPS;
}

export type CuttingGap = {
    /** 1-based G-code command index that broke the cut run. */
    line: number;
    lineTotal: number;
};

export type CuttingMoveHandlers = {
    /** Cutting linear displacement (G1, spindle on, tip in stock). */
    onMove: (move: CuttingMove) => void | false;
    /**
     * Motion that is not a cut (G0, spindle off, tip above stock).
     * Callers should flush any open same-Z line accumulator here.
     */
    onGap?: (gap: CuttingGap) => void | false;
};

/**
 * Walk toolpath commands; invoke handlers for cutting moves and non-cutting gaps.
 */
export function forEachCuttingMove(
    commands: ToolCommand[],
    options: MotionOptions,
    onMoveOrHandlers: ((move: CuttingMove) => void | false) | CuttingMoveHandlers,
): void {
    const handlers: CuttingMoveHandlers = typeof onMoveOrHandlers === 'function'
        ? { onMove: onMoveOrHandlers }
        : onMoveOrHandlers;

    const zEps = options.zEpsilon ?? DEFAULT_Z_EPS;
    const stockTopZ = options.stockTopZ ?? 0;
    const lineTotal = commands.length;

    let state: MachineState = {
        g: 0,
        x: 0,
        y: 0,
        z: stockTopZ + 5,
        spindleOn: false,
    };

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        const line = i + 1;
        const prev: Vec3 = { x: state.x, y: state.y, z: state.z };
        const nextState = applyCommand(state, cmd);

        const moved = prev.x !== nextState.x || prev.y !== nextState.y || prev.z !== nextState.z;
        const isMotion = cmd.G === 0 || cmd.G === 1
            || cmd.X !== undefined || cmd.Y !== undefined || cmd.Z !== undefined;

        // Spindle off / mode change without motion still ends a cut run
        const spindleDropped = state.spindleOn && !nextState.spindleOn;
        state = nextState;

        if (spindleDropped && handlers.onGap) {
            if (handlers.onGap({ line, lineTotal }) === false) {
                return;
            }
        }

        if (!isMotion || !moved) {
            continue;
        }

        if (!isCuttingMove(state, stockTopZ)) {
            if (handlers.onGap) {
                if (handlers.onGap({ line, lineTotal }) === false) {
                    return;
                }
            }
            continue;
        }

        const next: Vec3 = { x: state.x, y: state.y, z: state.z };
        const prevZQ = quantizeZ(prev.z, zEps);
        const zQ = quantizeZ(next.z, zEps);
        const result = handlers.onMove({
            prev,
            next,
            zQ,
            prevZQ,
            sameZ: sameZ(prevZQ, zQ, zEps),
            line,
            lineTotal,
        });
        if (result === false) {
            return;
        }
    }
}
