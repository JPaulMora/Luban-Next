/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
const path = require('path');
const findImports = require('find-imports');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const nib = require('nib');

const babelConfig = require('./babel.config');
const languages = require('./webpack.config.app-i18n').languages;

const publicPath = './';
const timestamp = new Date().getTime();

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

module.exports = {
    mode: 'production',
    target: 'electron-renderer',
    cache: true,
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts', '.tsx'],
        fallback: {
            fs: false,
            net: false,
            tls: false,
        },
    },
    entry: {
        polyfill: path.resolve(__dirname, 'src/app/polyfill/index.js'),
        vendor: findImports([
            'src/app/**/*.{js,jsx}',
            '!src/app/polyfill/**/*.js',
            '!src/app/**/*.development.js'
        ], { flatten: true }),
        app: path.resolve(__dirname, 'src/app/index.jsx'),
        'Pool.worker': path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js'),
        'clipperPool.worker': path.resolve(__dirname, 'src/app/lib/manager/clipperPool.worker.js'),
        'ClippingPoolManager.worker': path.resolve(__dirname, 'src/app/lib/manager/ClippingPoolManager.worker.ts'),
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/app'),
        chunkFilename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        filename: (pathData) => {
            if (isWorkerChunk(pathData.chunk.name)) {
                return '[name].js';
            }
            return `[name].[chunkhash].bundle.js?_=${timestamp}`;
        },
        publicPath: publicPath,
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
        splitChunks: {
            chunks(chunk) {
                return !isWorkerChunk(chunk.name);
            },
        },
    },
    plugins: [
        new webpack.ContextReplacementPlugin(
            /moment[/\\]locale$/,
            new RegExp(`^\\./(${without(languages, 'en').join('|')})$`)
        ),
        new WebpackManifestPlugin({
            fileName: 'manifest.json'
        }),
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
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                '@babel/preset-env',
                                [
                                    '@babel/preset-react',
                                    { pragma: 'createElement' },
                                ],
                            ],
                        },
                    },
                    {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    },
                ]
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig,
            },
            {
                test: /\.styl$/,
                use: [
                    MiniCssExtractPlugin.loader,
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
                include: [
                    path.resolve(__dirname, 'src/app/styles'),
                ]
            },
            {
                test: /\.styl$/,
                use: [
                    MiniCssExtractPlugin.loader,
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
                ],
                exclude: [
                    path.resolve(__dirname, 'src/app/styles')
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
            }
        ]
    },
};
