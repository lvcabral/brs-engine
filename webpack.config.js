const webpack = require('webpack');
const path = require("path");
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = env => {
    let outputLib, outputWrk, mode, distPath;
    let libraryName = "brsEmu";
    let workerName = "brsEmu.worker";
    if (env.production) {
        mode = "production";
        outputWrk = libraryName + ".worker.min.js";
        outputLib = libraryName + ".min.js";
        distPath = "app/lib"
    } else {
        mode = "development";
        outputWrk = libraryName + ".worker.js";
        outputLib = libraryName + ".js";
        distPath = "app/lib"
    }
    return [
        {
            entry: "./src/index.ts",
            target: "web",
            mode: mode,
            devtool: "inline-source-map",
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.brs$/,
                        type: "asset/source",
                    },
                    {
                        test: /\.csv$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: {
                fallback: {
                    fs: false,
                    readline: false,
                    path: require.resolve("path-browserify"),
                    stream: require.resolve("stream-browserify"),
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
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            output: {
                filename: outputLib,
                library: libraryName,
                libraryTarget: "umd",
                umdNamedDefine: true,
                path: path.resolve(__dirname, distPath),
                globalObject: "typeof self !== 'undefined' ? self : this",
            }
        }
    ];
};
