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
    },
    client: {
        overlay: {
            errors: true,
            warnings: false,
        },
    },
};

module.exports = {
    mode: 'development',
    target: 'web',
    // devtool: 'eval',
    devtool: 'eval-cheap-source-map',
    context: path.resolve(__dirname, 'src/app'),
    resolve: {
        modules: [
            path.resolve(__dirname, 'packages/*'),
            path.resolve(__dirname, 'src/shared'),
            path.resolve(__dirname, 'src/app'),
            'node_modules',
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
        app: path.resolve(__dirname, 'src/app/index.jsx'),
        polyfill: path.resolve(__dirname, 'src/app/polyfill/index.js'),
        ...rendererWorkerEntries,
    },
    output: {
        path: path.resolve(__dirname, 'output/src/app'),
        filename: (pathData) => {
            if (rendererWorkerNames.includes(pathData.chunk.name)) {
                return '[name].js';
            }
            return '[name].[fullhash].bundle.js';
        },
        publicPath: '',
        globalObject: 'this',
        library: { type: 'umd' },
    },
    optimization: {
        minimize: false,
        emitOnErrors: false,
        splitChunks: {
            chunks: (chunk) => !rendererWorkerNames.includes(chunk.name),
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
        // Generates a manifest.json file in your root output directory with a mapping of all source file names to their corresponding output file.
        new WebpackManifestPlugin(),
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
                test: /(\.jsx?|\.tsx?)$/,
                loader: 'eslint-loader',
                exclude: /node_modules/,
                options: {
                    cache: false,
                    fix: false,
                    emitWarning: false,
                    quiet: true,
                    configFile: path.resolve(__dirname, '.eslintrc.js'),
                },
            },
            // TypeScript/TSX
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                // exclude: /node_modules/,
                options: {
                    transpileOnly: true,
                },
            },
            // JavaScript/JSX
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
            // Stylus
            {
                test: /\.styl$/,
                oneOf: [
                    // global styles
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
                    // module
                    {
                        exclude: [
                            path.resolve(__dirname, 'src/app/styles')
                        ],
                        use: [
                            'style-loader',
                            {
                                loader: 'css-loader',
                                options: {
                                    importLoaders: 1, // loaders applied before css loader
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
            // CSS files
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            // image files
            {
                test: /\.(png|jpg|svg)$/,
                loader: 'url-loader',
                options: {
                    limit: 8192
                }
            },
            // font files
            {
                test: /\.(ttf|woff|woff2|eot)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'file-loader'
            },
        ]
    },
    devServer: devServer,
};
