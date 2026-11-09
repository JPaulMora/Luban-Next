export { resolveBitProfile, radiusAtHeightAboveTip, footprintRadiusAtStockTop } from './bitProfile';
export type { BitKind, BitProfile } from './bitProfile';
export { forEachCuttingMove, DEFAULT_Z_EPS } from './cuttingMotion';
export { createDexelStock, carveCell } from './dexelStock';
export type { DexelStock } from './dexelStock';
export { stampBitAtTip, surfaceZUnderBit, stampRadiusXY } from './bitStamp';
export { carveDexelFromCommands } from './carveDexel';
export { dexelToMesh } from './dexelToMesh';
export { runSolidSimulation } from './runSolidSimulation';
export type { CarveSegment, RunSolidSimulationInput } from './runSolidSimulation';
export { stockSpecFromSegments } from './stockBounds';
export {
    DEXEL_CELL_MM,
    DEXEL_PATH_STEP_MM,
} from './types';
export type {
    Vec3,
    ToolCommand,
    ToolParams,
    StockSpec,
    MeshBuffers,
    SolidSimResult,
} from './types';
