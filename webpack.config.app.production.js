/* eslint no-var: 0 */
/* eslint prefer-arrow-callback: 0 */
const without = require('lodash/without');
// const crypto = require('crypto');
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
// const pkg = require('./package.json');

// Use publicPath for production
// const publicPath = (function calculatePublicPath(payload) {
//     const algorithm = 'sha1';
//     const buf = String(payload);
//     const hash = crypto.createHash(algorithm).update(buf).digest('hex');
//     return `/${hash.substr(0, 8)}/`; // 8 digits
// }(pkg.version));
const publicPath = './';
const timestamp = new Date().getTime();

const rendererWorkerEntries = {
    'Pool.worker': path.resolve(__dirname, 'src/app/lib/manager/Pool.worker.js'),
    'clipperPool.worker': path.resolve(__dirname, 'src/app/lib/manager/clipperPool.worker.js'),
    'ClippingPoolManager.worker': path.resolve(
        __dirname,
        'src/app/lib/manager/ClippingPoolManager.worker.ts'
    ),
};
const rendererWorkerNames = Object.keys(rendererWorkerEntries);

const stylusLoaderOptions = {
    stylusOptions: {
        use: [nib()],
        import: [require.resolve('nib/lib/nib/index.styl')],
    },
};

module.exports = {
    mode: 'production',
    target: 'web',
    cache: true,
    // devtool: 'source-map', // used in pre-production, comment this on production
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules'
        ],
        extensions: ['.js', '.json', '.jsx', '.styl', '.ts', '.tsx'],
        alias: {
            'threads/dist/master/pool-types': path.resolve(
                __dirname,
                'node_modules/threads/dist/master/pool-types.js'
            ),
            // Webpack 5 exports field picks Dexie's ESM class; ts-loader
            // emits ES5 subclasses that must call the CJS constructor.
            dexie: path.resolve(__dirname, 'node_modules/dexie/dist/dexie.js'),
        },
        fallback: {
            fs: false,
            net: false,
            tls: false,
            path: require.resolve('path-browserify'),
            stream: require.resolve('stream-browserify'),
            events: require.resolve('events/'),
            timers: require.resolve('timers-browserify'),
        },
    },
    entry: {
        polyfill: path.resolve(__dirname, 'src/app/polyfill/index.js'),
        vendor: findImports([
            'src/app/**/*.{js,jsx}',
            '!src/app/polyfill/**/*.js',
            '!src/app/**/*.development.js',
            '!src/app/lib/manager/*.worker.js',
        ], { flatten: true }),
        app: path.resolve(__dirname, 'src/app/index.jsx'),
        ...rendererWorkerEntries,
    },
    output: {
        path: path.resolve(__dirname, 'dist/Luban/src/app'),
        chunkFilename: `[name].[chunkhash].bundle.js?_=${timestamp}`,
        filename: (pathData) => {
            if (rendererWorkerNames.includes(pathData.chunk.name)) {
                return '[name].js';
            }
            return `[name].[chunkhash].bundle.js?_=${timestamp}`;
        },
        publicPath: publicPath,
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin()],
    },
    plugins: [
        new webpack.ContextReplacementPlugin(
            /moment[/\\]locale$/,
            new RegExp(`^\\./(${without(languages, 'en').join('|')})$`)
        ),
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
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
            excludeChunks: rendererWorkerNames,
        })
    ],
    module: {
        rules: [
            // Webpack 5 treats .js as ESM when a package.json has "type": "module".
            {
                test: /parameter-context\.es5\.js$/,
                type: 'javascript/auto',
            },
            // ESLint
            {
                enforce: 'pre',
                test: /\.(jsx?|tsx?)$/,
                loader: 'eslint-loader',
                exclude: /node_modules/,
                options: {
                    cache: false,
                    fix: true,
                    emitWarning: false,
                    quiet: true,
                    configFile: path.resolve(__dirname, '.eslintrc.js'),
                },
            },
            // TypeScript/TSX
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
            // JavaScript/JSX
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                loader: 'babel-loader',
                options: babelConfig,
            },
            // global styles
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
            // Stylus
            {
                test: /\.styl$/,
                use: [
                    // 'style-loader',
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
            // CSS files
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            // image files
            {
                test: /\.(png|jpg|svg)$/,
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: 8192,
                    },
                },
            },
            // font files
            {
                test: /\.(ttf|woff|woff2|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                type: 'asset/resource',
            }
        ]
    },
};
