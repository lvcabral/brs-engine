const path = require("path");
const WebpackObfuscator = require('webpack-obfuscator');

module.exports = env => {
    const isProduction = env.NODE_ENV === "production";
    let outputLib, outputWrk, mode, distPath;
    let libraryName = "brsEmu";
    let workerName = "brsEmu.worker";
    if (isProduction) {
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
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/env", "@babel/preset-typescript"]
                        },
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new WebpackObfuscator(
                    {
                        rotateUnicodeArray: true,
                    },
                    ["brsEmu.js", "brsEmu.worker.js"]
                ),
            ],
            node: { fs: "empty", readline: "empty" },
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
            entry: "./src/api/device.ts",
            target: "web",
            mode: mode,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/env", "@babel/preset-typescript"]
                        },
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
                path: path.resolve(__dirname, distPath),
                globalObject: "typeof self !== 'undefined' ? self : this",
            }
        }
    ];
};
