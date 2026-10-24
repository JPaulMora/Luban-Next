/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const crypto = require('crypto');
const path = require('path');
const webpack = require('webpack');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

const NODE_MODULES = path.resolve(__dirname, 'node_modules');

const nodeExternals = ({ request }, callback) => {
    if (request && !request.startsWith('.') && !path.isAbsolute(request)) {
        return callback(null, `commonjs ${request}`);
    }
    callback();
};

// Use publicPath for production
const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`; // 8 digits
}(pkg.version));

module.exports = {
    mode: 'development',
    devtool: 'eval-source-map',
    target: 'node',
    watch: true,
    context: path.resolve(__dirname, './src/server'),
    entry: {
        'Pool.worker': path.resolve(__dirname, './src/server/services/task-manager/Pool.worker.js'),
    },
    output: {
        path: path.resolve(__dirname, 'output/src/server'),
        filename: '[name].js',
        library: { type: 'commonjs2' },
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
                    transpileOnly: true,
                },
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig
            }
        ]
    },
    externals: [nodeExternals],
    resolve: {
        extensions: ['.js', '.json', '.jsx', '.ts']
    },
    resolveLoader: {
        modules: [NODE_MODULES]
    },
};
