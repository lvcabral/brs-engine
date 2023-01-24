const path = require("path");
const JavaScriptObfuscator = require("webpack-obfuscator");

module.exports = env => {
    const isProduction = env.NODE_ENV === "production";
    let outputLib, outputWrk, mode, distPath;
    let libraryName = "brsEmu";
    let workerName = "brsEmu.worker";
    if (isProduction) {
        mode = "production";
        outputWrk = libraryName + ".worker.min.js";
        outputLib = libraryName + ".min.js";
        distPath = "dist"
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
                path: path.join(__dirname, distPath),
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
              path: path.resolve(__dirname, distPath),
              globalObject: "typeof self !== 'undefined' ? self : this",
            }
        }
    ];
};
