const crypto = require('crypto');
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const babelConfig = require('./babel.config');
const pkg = require('./package.json');

const NODE_MODULES = path.resolve(__dirname, 'node_modules');

const nodeExternals = ({ request }, callback) => {
    // TypeScript source. Node loads package "main" (index.ts) as CJS and
    // throws on the import statement. Compile it into this bundle instead.
    if (request === '@snapmaker/luban-platform') {
        return callback();
    }
    if (request && !request.startsWith('.') && !path.isAbsolute(request)) {
        return callback(null, `commonjs ${request}`);
    }
    return callback();
};

// Use publicPath for production
// const payload = pkg.version;
const publicPath = (function calculatePublicPath(payload) {
    const algorithm = 'sha1';
    const buf = String(payload);
    const hash = crypto.createHash(algorithm).update(buf).digest('hex');
    return `/${hash.substr(0, 8)}/`; // 8 digits
}(pkg.version));

module.exports = {
    mode: 'production',
    target: 'node',
    context: path.resolve(__dirname, 'src/server'),
    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.json', '.jsx', '.ts'],
        alias: {
            '@snapmaker/luban-platform': path.resolve(
                __dirname,
                'packages/luban-platform/index.ts'
            ),
        },
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
            // Webpack 5 treats .js as ESM when package.json has "type": "module".
            {
                test: /parameter-context\.es5\.js$/,
                type: 'javascript/auto',
            },
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
    externals: [nodeExternals],
    resolveLoader: {
        modules: [NODE_MODULES]
    },
};
