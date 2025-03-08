const webpack = require("webpack");
const path = require("path");

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs";
    let distPath = "../browser/lib";
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
        TASK: true,
        "ifdef-verbose": true,
    };
    return [
        {
            entry: "./src/core/index.ts",
            target: "webworker",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            onlyCompileBundledFiles: true,
                            configFile: "tsconfig.json",
                        },
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
                    net: false,
                    crypto: require.resolve("crypto-browserify"),
                    path: require.resolve("path-browserify"),
                    stream: require.resolve("stream-browserify"),
                    "process/browser": require.resolve("process/browser"),
                    timers: false,
                    vm: false,
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
                new webpack.DefinePlugin({
                    "process.env.CREATION_TIME": JSON.stringify(new Date().toISOString())
                })
            ],
            externals: {
                canvas: "commonjs canvas" // Important (2)
            },
            output: {
                path: path.join(__dirname, distPath),
                filename: libName + ".task.js",
                library: libName + "-task",
                libraryTarget: "umd",
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
    ];
};
