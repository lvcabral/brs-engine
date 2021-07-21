const path = require("path");
const JavaScriptObfuscator = require("webpack-obfuscator");

module.exports = env => {
    const isProduction = env.NODE_ENV === "production";
    let outputLib, outputApp, mode;
    let appName = "brsApp";
    let libraryName = "brsEmu";
    if (isProduction) {
        mode = "production";
        outputApp = appName + ".min.js";
        outputLib = libraryName + ".min.js";
    } else {
        mode = "development";
        outputApp = appName + ".js";
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
                    ["brsEmu.js"]
                ),
            ],
            node: { fs: "empty", readline: "empty" },
            output: {
                path: path.join(__dirname, "app/lib"),
                filename: outputLib,
                library: libraryName,
                libraryTarget: "umd",
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            entry: "./src/app/index.js",
            target: "web",
            mode: mode,
            output: {
              filename: outputApp,
              library: appName,
              path: path.resolve(__dirname, "app"),
              globalObject: "typeof self !== 'undefined' ? self : this",
            }
        }
    ];
};
