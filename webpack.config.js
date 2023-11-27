const webpack = require("webpack");
const path = require("path");
const WebpackObfuscator = require("webpack-obfuscator");
const { StatsWriterPlugin } = require("webpack-stats-plugin");

module.exports = (env) => {
    let outputLib, outputWrk, mode, distPath, sourceMap;
    let libraryName = "brsEmu";
    let workerName = "brsEmu.worker";
    if (env.production) {
        mode = "production";
        outputWrk = libraryName + ".worker.min.js";
        outputLib = libraryName + ".min.js";
        distPath = "app/lib";
        sourceMap = false;
    } else {
        mode = "development";
        outputWrk = libraryName + ".worker.js";
        outputLib = libraryName + ".js";
        distPath = "app/lib";
        sourceMap = "inline-cheap-module-source-map";
    }
    const ifdef_opts = {
        DEBUG: mode === "development",
        "ifdef-verbose": false,
    };
    return [
        {
            entry: "./src/index.ts",
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
                new WebpackObfuscator(
                    {
                        rotateUnicodeArray: true,
                    },
                    ["brsEmu.js", "brsEmu.worker.js"]
                ),
                // Write out stats file to build directory.
                new StatsWriterPlugin({
                    filename: "stats.json", // Default
                    stats: {
                        assets: true,
                        chunkModules: true
                    }
                }),
            ],
            output: {
                path: path.join(__dirname, distPath),
                filename: outputWrk,
                library: workerName,
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
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                // Write out stats file to build directory.
                new StatsWriterPlugin({
                    filename: "stats-api.json", // Default
                    stats: {
                        assets: true,
                        chunkModules: true
                    }
                }),
            ],
            output: {
                filename: outputLib,
                library: libraryName,
                libraryTarget: "umd",
                umdNamedDefine: true,
                path: path.resolve(__dirname, distPath),
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
    ];
};
