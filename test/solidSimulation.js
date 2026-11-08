import { test } from 'tape';

require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true,
    },
});

const {
    resolveBitProfile,
    radiusAtHeightAboveTip,
    footprintRadiusAtStockTop,
    createDexelStock,
    stampBitAtTip,
    surfaceZUnderBit,
    carveDexelFromCommands,
    dexelToMesh,
    runSolidSimulation,
    DEXEL_CELL_MM,
} = require('../src/server/lib/cnc/solidSimulation');

test('resolveBitProfile defaults to flat with diameter', (t) => {
    const flat = resolveBitProfile({ toolDiameter: 6 });
    t.equal(flat.kind, 'flat');
    t.equal(flat.radius, 3);
    t.end();
});

test('resolveBitProfile reads ball and vbit', (t) => {
    const ball = resolveBitProfile({ toolType: 'ballend', toolDiameter: 4 });
    t.equal(ball.kind, 'ball');
    t.equal(ball.radius, 2);

    const vbit = resolveBitProfile({
        toolType: 'vbit',
        toolDiameter: 0.1,
        toolAngle: 60,
        toolShaftDiameter: 3.175,
    });
    t.equal(vbit.kind, 'vbit');
    t.equal(vbit.angleDeg, 60);

    const missingAngle = resolveBitProfile({ toolType: 'vbit', toolDiameter: 3 });
    t.equal(missingAngle.kind, 'flat');
    t.end();
});

test('resolveBitProfile treats Luban flat end mill as flat', (t) => {
    const byType = resolveBitProfile({
        toolType: 'flat',
        toolDiameter: 3.175,
        toolAngle: 180,
        definitionName: '3 Flute Flat End',
    });
    t.equal(byType.kind, 'flat');
    t.equal(byType.radius, 3.175 / 2);

    const byAngle = resolveBitProfile({ toolDiameter: 3.175, toolAngle: 180 });
    t.equal(byAngle.kind, 'flat');

    const byName = resolveBitProfile({
        toolDiameter: 3.175,
        toolAngle: 90,
        definitionName: 'Flat End Mill 3.175',
    });
    t.equal(byName.kind, 'flat');
    t.end();
});

test('radiusAtHeightAboveTip for V-bit and ball', (t) => {
    const vbit = resolveBitProfile({
        toolType: 'vbit',
        toolAngle: 90,
        toolDiameter: 0.1,
        toolShaftDiameter: 10,
    });
    t.ok(Math.abs(radiusAtHeightAboveTip(vbit, 2) - 2) < 1e-6);

    const ball = resolveBitProfile({ toolType: 'ball', toolDiameter: 4 });
    t.ok(Math.abs(radiusAtHeightAboveTip(ball, 0)) < 1e-6);
    t.ok(Math.abs(radiusAtHeightAboveTip(ball, 2) - 2) < 1e-6);
    t.end();
});

test('footprintRadiusAtStockTop for flat equals tool radius', (t) => {
    const flat = resolveBitProfile({ toolDiameter: 3.175 });
    t.equal(footprintRadiusAtStockTop(flat, -5), flat.radius);
    t.end();
});

test('flat stamp lowers cells to tip Z across diameter', (t) => {
    const stock = createDexelStock(
        { minX: -5, maxX: 5, minY: -5, maxY: 5, stockDepth: 10 },
        0.2,
    );
    const flat = resolveBitProfile({ toolType: 'flat', toolDiameter: 2 });
    stampBitAtTip(stock, flat, 0, 0, -3);

    // Cell at origin should be at tip Z
    const mid = Math.floor(stock.nx / 2) * 1 + Math.floor(stock.ny / 2) * stock.nx;
    // Use center cell via stamp math
    const zCenter = surfaceZUnderBit(flat, 0, 0, -3, 0, 0);
    t.equal(zCenter, -3);

    let carved = 0;
    for (let i = 0; i < stock.z.length; i++) {
        if (stock.z[i] < -0.01) {
            carved += 1;
            t.ok(stock.z[i] <= -2.99 && stock.z[i] >= -3.01);
        }
    }
    t.ok(carved > 10, `expected carved cells, got ${carved}`);
    t.ok(mid >= 0);
    t.end();
});

test('vbit footprint grows with depth', (t) => {
    const vbit = resolveBitProfile({
        toolType: 'vbit',
        toolAngle: 90,
        toolDiameter: 0.1,
        toolShaftDiameter: 10,
    });
    // 90° → half 45° → radius = height above tip
    t.equal(surfaceZUnderBit(vbit, 0, 0, -2, 0, 0), -2);
    const shallow = surfaceZUnderBit(vbit, 0, 0, -0.5, 1.5, 0);
    const deep = surfaceZUnderBit(vbit, 0, 0, -3, 1.5, 0);
    // Shallow tip: cone only reaches r=0.5 at stock top — 1.5 mm is above stock (z>0)
    t.ok(shallow !== null && shallow > 0, '1.5 mm off-axis is above stock for shallow tip');
    // Deep tip: cone reaches r=3 at stock top — surface at 1.5 mm is below top
    t.ok(deep !== null && deep < 0, '1.5 mm off-axis carved when tip is deep');
    t.ok(footprintRadiusAtStockTop(vbit, -0.5) < footprintRadiusAtStockTop(vbit, -3));
    t.end();
});

test('carveDexelFromCommands long vbit path completes', (t) => {
    const commands = [{ M: 3 }, { G: 1, X: 0, Y: 0, Z: -1 }];
    for (let i = 1; i <= 100; i++) {
        commands.push({ G: 1, X: i * 0.2, Y: 0, Z: -1 });
    }
    commands.push({ M: 5 });

    const stock = carveDexelFromCommands(commands, {
        toolParams: {
            toolType: 'vbit',
            toolAngle: 30,
            toolDiameter: 0.2,
            toolShaftDiameter: 3.175,
        },
        stock: { minX: -2, maxX: 25, minY: -2, maxY: 2, stockDepth: 5 },
        cellMm: 0.2,
        pathStepMm: 0.2,
    });
    t.ok(stock);
    let lowered = 0;
    for (let i = 0; i < stock.z.length; i++) {
        if (stock.z[i] < -0.1) {
            lowered += 1;
        }
    }
    t.ok(lowered > 0);
    t.end();
});

test('runSolidSimulation returns mesh buffers', (t) => {
    const commands = [
        { M: 3 },
        { G: 0, Z: 2 },
        { G: 0, X: -3, Y: 0 },
        { G: 1, Z: -2 },
        { G: 1, X: 3, Y: 0 },
        { G: 0, Z: 2 },
        { M: 5 },
    ];
    const result = runSolidSimulation({
        commands,
        toolParams: { toolType: 'flat', toolDiameter: 2 },
        stock: { minX: -10, maxX: 10, minY: -10, maxY: 10, stockDepth: 8 },
    });
    t.ok(result);
    t.ok(result.positions.length >= 9);
    t.ok(result.indices.length >= 3);
    t.equal(result.stockDepth, 8);
    t.equal(result.positions.length % 3, 0);
    t.equal(DEXEL_CELL_MM, 0.1);
    t.end();
});

test('dexelToMesh produces triangles', (t) => {
    const stock = createDexelStock(
        { minX: -2, maxX: 2, minY: -2, maxY: 2, stockDepth: 4 },
        0.5,
    );
    const flat = resolveBitProfile({ toolType: 'flat', toolDiameter: 1 });
    stampBitAtTip(stock, flat, 0, 0, -1);
    const mesh = dexelToMesh(stock);
    t.ok(mesh.indices.length >= 3);
    t.equal(mesh.positions.length % 3, 0);
    t.end();
});

test('dexelToMesh crops to carved region on large stock', (t) => {
    const stock = createDexelStock(
        { minX: -50, maxX: 50, minY: -50, maxY: 50, stockDepth: 5 },
        1,
    );
    const vbit = resolveBitProfile({
        toolType: 'vbit',
        toolAngle: 60,
        toolDiameter: 0.2,
        toolShaftDiameter: 3.175,
    });
    stampBitAtTip(stock, vbit, 0, 0, -2);
    const mesh = dexelToMesh(stock);
    // Full 100x100 grid would be ~40k quads * 4 verts; cropped V stamp stays small
    t.ok(mesh.positions.length / 3 < 5000, `verts=${mesh.positions.length / 3}`);
    t.ok(mesh.indices.length >= 3);
    t.end();
});

test('writeMeshJson handles large arrays without stringify', (t) => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { writeMeshJson } = require('../src/server/lib/cnc/solidSimulation/writeMeshJson');
    const n = 50000;
    const positions = new Array(n);
    for (let i = 0; i < n; i++) {
        positions[i] = i * 0.001;
    }
    const file = path.join(os.tmpdir(), `solid-sim-test-${Date.now()}.json`);
    writeMeshJson(file, {
        positions,
        normals: positions.slice(),
        indices: [0, 1, 2],
        stockDepth: 5,
        bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1, stockDepth: 5 },
    });
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    t.equal(parsed.kind, 'solidSim');
    t.equal(parsed.positions.length, n);
    t.equal(parsed.positions[n - 1], (n - 1) * 0.001);
    fs.unlinkSync(file);
    t.end();
});
