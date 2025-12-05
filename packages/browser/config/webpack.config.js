const webpack = require("webpack");
const path = require("node:path");
const { StatsWriterPlugin } = require("webpack-stats-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs";
    let distPath = "../lib";
    if (env.production) {
        mode = "production";
        sourceMap = false;
    } else {
        mode = "development";
        sourceMap = "inline-cheap-module-source-map";
    }
    const ifdef_opts = {
        DEBUG: mode === "development",
        BROWSER: true,
        "ifdef-verbose": false,
    };
    const tsLoaders = () => [
        {
            loader: "ts-loader",
            options: {
                configFile: path.resolve(__dirname, "./tsconfig.json"),
            },
        },
        {
            loader: "ifdef-loader",
            options: ifdef_opts,
        },
    ];

    return [
        {
            name: "worker",
            entry: "../../src/core/index.ts",
            target: "webworker",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        use: tsLoaders(),
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.brs$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: {
                fallback: {
                    fs: false,
                    readline: false,
                    net: false,
                    crypto: require.resolve("crypto-browserify"),
                    path: require.resolve("path-browserify"),
                    stream: require.resolve("stream-browserify"),
                    "process/browser": require.resolve("process/browser"),
                    timers: false,
                    vm: false,
                },
                modules: [path.resolve("../../node_modules"), path.resolve("../../src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new webpack.ProvidePlugin({
                    process: "process/browser",
                }),
                new webpack.ProvidePlugin({
                    Buffer: ["buffer", "Buffer"],
                }),
                // Write out stats file to build directory.
                new StatsWriterPlugin({
                    filename: "stats.json",
                    stats: {
                        assets: true,
                        chunkModules: true,
                    },
                }),
                new webpack.DefinePlugin({
                    "process.env.CREATION_TIME": JSON.stringify(new Date().toISOString()),
                }),
            ],
            externals: {
                canvas: "commonjs canvas", // Important (2)
                "./brs-sg.js": "./brs-sg.js",
            },
            output: {
                path: path.join(__dirname, distPath),
                filename: libName + ".worker.js",
                library: {
                    name: ["self", "brsEngine"],
                    type: "assign",
                    export: "default",
                },
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            name: "api",
            entry: "../../src/api/index.ts",
            target: "web",
            mode: mode,
            devtool: sourceMap,
            devServer: {
                static: "./",
                port: 6502,
                headers: {
                    "cross-origin-embedder-policy": "require-corp",
                    "cross-origin-opener-policy": "same-origin",
                },
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        use: tsLoaders(),
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.csv$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("../../node_modules"), path.resolve("../../src/api")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                // Write out stats file to build directory.
                new StatsWriterPlugin({
                    filename: "stats-api.json",
                    stats: {
                        assets: true,
                        chunkModules: true,
                    },
                }),
            ],
            output: {
                filename: libName + ".api.js",
                library: libName,
                libraryTarget: "umd",
                umdNamedDefine: true,
                path: path.resolve(__dirname, distPath),
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            entry: {},
            mode: "production",
            output: {
                path: path.resolve(__dirname, `../../../out/common_zip/`),
                publicPath: "/",
            },
            plugins: [
                new CopyPlugin({
                    patterns: [{ from: "../../src/core/common/**", to: "./" }],
                }),
                new ZipPlugin({
                    path: "../../packages/browser/assets",
                    filename: `common.zip`,
                    extension: "zip",
                    zipOptions: {
                        forceZip64Format: false,
                    },
                    exclude: [/\.csv$/],
                    pathMapper: function (assetPath) {
                        return assetPath.replace("../../src/core/common/", "");
                    },
                }),
            ],
        },
    ];
};
