/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const nib = require('nib');
const babelConfig = require('./babel.config');

const languages = require('./webpack.config.app-i18n').languages;
const pkg = require('./package.json');

const { CLIENT_PORT, SERVER_PORT } = pkg.config;

const workerEntries = [
    'Pool.worker',
    'clipperPool.worker',
    'ClippingPoolManager.worker',
];

const isWorkerChunk = (name) => name && String(name).endsWith('.worker');

const stylusLoaderOptions = {
    stylusOptions: {
        use: [nib()],
        import: [require.resolve('nib/lib/nib/index.styl')],
    },
};

const devServer = {
    hot: true,
    port: CLIENT_PORT,
    static: {
        directory: path.resolve(__dirname, 'output/src/app'),
    },
    proxy: {
        '/api': `http://localhost:${SERVER_PORT}`,
        '/data': `http://localhost:${SERVER_PORT}`,
        '/worker': `http://localhost:${SERVER_PORT}`,
        '/resources': `http://localhost:${SERVER_PORT}`,
        '/socket.io': {
            target: `ws://localhost:${SERVER_PORT}`,
            ws: true
        },
    },
    devMiddleware: {
        index: true,
        writeToDisk: true,
    }
};

module.exports = {
    mode: 'development',
    target: 'electron-renderer',
    devtool: 'eval-cheap-source-map',
    context: path.resolve(__dirname, 'src/app'),
    cache: { type: 'filesystem' },
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules',
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts', '.tsx'],
        fallback: {
            fs: false,
            net: false,
            tls: false,
        },
    },
    entry: {
        app: {
            import: path.resolve(__dirname, 'src/app/index.jsx'),
            library: { type: 'umd' },
        },
        polyfill: {
            import: path.resolve(__dirname, 'src/app/polyfill/index.js'),
            library: { type: 'umd' },
        },
        'Pool.worker': path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js'),
        'clipperPool.worker': path.resolve(__dirname, 'src/app/lib/manager/clipperPool.worker.js'),
        'ClippingPoolManager.worker': path.resolve(__dirname, 'src/app/lib/manager/ClippingPoolManager.worker.ts'),
    },
    output: {
        path: path.resolve(__dirname, 'output/src/app'),
        filename: (pathData) => {
            if (isWorkerChunk(pathData.chunk.name)) {
                return '[name].js';
            }
            return '[name].[fullhash].bundle.js';
        },
        chunkFilename: '[name].[fullhash].bundle.js',
        publicPath: '',
        globalObject: 'this',
        clean: false,
    },
    optimization: {
        minimize: false,
        emitOnErrors: false,
        splitChunks: {
            chunks(chunk) {
                return !isWorkerChunk(chunk.name);
            },
            cacheGroups: {
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -10
                }
            },
        }
    },
    plugins: [
        new webpack.ContextReplacementPlugin(
            /moment[/\\]locale$/,
            new RegExp(`^\\./(${without(languages, 'en').join('|')})$`)
        ),
        new WebpackManifestPlugin(),
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css'
        }),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.resolve(__dirname, 'src/app/resources/assets/index.html'),
            excludeChunks: workerEntries,
        })
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                    transpileOnly: true,
                },
            },
            {
                test: /\.jsx?$/,
                include: [
                    path.resolve(__dirname, 'packages/*'),
                    path.resolve(__dirname, 'src/app'),
                    path.resolve(__dirname, 'src/shared'),
                ],
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: {
                    ...babelConfig,
                    cacheDirectory: true
                },
            },
            {
                test: /\.styl$/,
                oneOf: [
                    {
                        include: [
                            path.resolve(__dirname, 'src/app/styles')
                        ],
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                    modules: {
                                        mode: 'global',
                                        exportLocalsConvention: 'camelCase',
                                    },
                                    esModule: false,
                                }
                            },
                            {
                                loader: 'stylus-loader',
                                options: stylusLoaderOptions,
                            },
                        ],
                    },
                    {
                        exclude: [
                            path.resolve(__dirname, 'src/app/styles')
                        ],
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1,
                                    modules: {
                                        mode: 'local',
                                        exportLocalsConvention: 'camelCase',
                                        localIdentName: '[path][name]__[local]--[hash:base64:5]',
                                    },
                                    esModule: false,
                                }
                            },
                            {
                                loader: 'stylus-loader',
                                options: stylusLoaderOptions,
                            },
                        ]
                    },
                ]
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|svg)$/,
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: 8192,
                    },
                },
            },
            {
                test: /\.(ttf|woff|woff2|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                type: 'asset/resource',
            },
        ]
    },
    devServer: devServer,
};
