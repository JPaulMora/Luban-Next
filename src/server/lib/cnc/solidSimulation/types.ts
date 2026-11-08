export type Vec3 = { x: number; y: number; z: number };

export type ToolCommand = {
    G?: number;
    M?: number;
    X?: number;
    Y?: number;
    Z?: number;
    B?: number;
    F?: number;
    S?: number;
    P?: number;
};

export type ToolParams = {
    toolType?: string;
    toolDiameter?: number;
    toolAngle?: number;
    toolShaftDiameter?: number;
    definitionId?: string;
    definitionName?: string;
};

/** Fixed dexel resolution (mm) — matches Artisan-class repeatability. */
export const DEXEL_CELL_MM = 0.1;

/** Sample G1 segments at most this far apart (mm). */
export const DEXEL_PATH_STEP_MM = 0.1;

export type StockSpec = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    stockDepth: number;
};

export type MeshBuffers = {
    positions: number[];
    normals: number[];
    indices: number[];
};

export type SolidSimResult = MeshBuffers & {
    stockDepth: number;
    bounds: StockSpec;
};
