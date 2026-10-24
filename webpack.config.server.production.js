const crypto = require('crypto');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

const NODE_MODULES = path.resolve(__dirname, 'node_modules');

const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`;
}(pkg.version));

module.exports = {
    mode: 'production',
    target: 'node',
    externalsPresets: { node: true },
    context: path.resolve(__dirname, 'src/server'),
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.json', '.jsx', '.ts']
    },
    entry: {
        index: './index.js',
        'Pool.worker': './services/task-manager/Pool.worker.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/server'),
        filename: '[name].js',
        library: { type: 'commonjs2' },
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new webpack.DefinePlugin({
            'global.PUBLIC_PATH': JSON.stringify(publicPath)
        })
    ],
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true
                }
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig
            }
        ]
    },
    externals: [
        ({ request }, callback) => {
            if (!request || request.startsWith('.') || path.isAbsolute(request)) {
                callback();
                return;
            }
            callback(null, `commonjs ${request}`);
        },
    ],
    resolveLoader: {
        modules: [NODE_MODULES]
    },
};
