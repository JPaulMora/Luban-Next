const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'packages/luban-platform/dist');
const watch = process.argv.includes('--watch');

if (!watch) {
    fs.rmSync(dist, { recursive: true, force: true });
}

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(
    path.join(dist, 'package.json'),
    '{ "type": "commonjs" }\n'
);

const child = spawn(process.execPath, [
    path.join(root, 'node_modules/typescript/bin/tsc'),
    '-p',
    'packages/luban-platform/tsconfig.build.json',
    ...(watch ? ['--watch'] : []),
], {
    cwd: root,
    stdio: 'inherit',
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code || 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
