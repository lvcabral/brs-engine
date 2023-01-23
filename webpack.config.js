const path = require("path");
const JavaScriptObfuscator = require("webpack-obfuscator");

module.exports = env => {
    const isProduction = env.NODE_ENV === "production";
    let outputLib, outputApp, mode;
    let libraryName = "brsEmu";
    let workerName = "brsEmu.worker";
    if (isProduction) {
        mode = "production";
        outputWrk = workerName + ".min.js";
        outputLib = libraryName + ".min.js";
    } else {
        mode = "development";
        outputWrk = workerName + ".js";
        outputLib = libraryName + ".js";
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
                ],
            },
            resolve: {
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new JavaScriptObfuscator(
                    {
                        rotateUnicodeArray: true,
                    },
                    ["brsEmu.worker.js"]
                ),
            ],
            node: { fs: "empty", readline: "empty" },
            output: {
                path: path.join(__dirname, "app/lib"),
                filename: outputWrk,
                library: workerName,
                libraryTarget: "umd",
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            entry: "./src/app/device.js",
            target: "web",
            mode: mode,
            output: {
              filename: outputLib,
              library: libraryName,
              path: path.resolve(__dirname, "app/lib"),
              globalObject: "typeof self !== 'undefined' ? self : this",
            }
        }
    ];
};
