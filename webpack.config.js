const webpack = require("webpack");
const path = require("path");
const { StatsWriterPlugin } = require("webpack-stats-plugin");

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs";
    let distPath = "app/lib";
    if (env.production) {
        mode = "production";
        sourceMap = false;
    } else {
        mode = "development";
        sourceMap = "inline-cheap-module-source-map";
    }
    const ifdef_opts = {
        DEBUG: mode === "development",
        WORKER: true,
        "ifdef-verbose": false,
    };
    return [
        {
            entry: "./src/worker/index.ts",
            target: "web",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.tsx?$/,
                        loader: "ifdef-loader",
                        options: ifdef_opts,
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
                    crypto: require.resolve("crypto-browserify"),
                    path: require.resolve("path-browserify"),
                    stream: require.resolve("stream-browserify"),
                    "process/browser": require.resolve("process/browser"),
                    timers: false,
                },
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
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
                        chunkModules: true
                    }
                }),
            ],
            output: {
                path: path.join(__dirname, distPath),
                filename: libName + ".worker.js",
                library: libName + "-worker",
                libraryTarget: "umd",
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            entry: "./src/api/index.ts",
            target: "web",
            mode: mode,
            devtool: sourceMap,
            devServer: {
                static: "./app",
                port: 6502,
                headers: {
                    "cross-origin-embedder-policy": "require-corp",
                    "cross-origin-opener-policy": "same-origin",
                }
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.tsx?$/,
                        loader: "ifdef-loader",
                        options: ifdef_opts,
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.csv$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("./node_modules"), path.resolve("./src/api")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                // Write out stats file to build directory.
                new StatsWriterPlugin({
                    filename: "stats-api.json",
                    stats: {
                        assets: true,
                        chunkModules: true
                    }
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
    ];
};
