const webpack = require("webpack");
const path = require("node:path");
const ShebangPlugin = require("webpack-shebang-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs";
    let cliPath = "../bin";
    if (env.production) {
        mode = "production";
        sourceMap = false;
    } else {
        mode = "development";
        sourceMap = "inline-cheap-module-source-map";
    }
    const ifdef_opts = {
        DEBUG: mode === "development",
        BROWSER: false,
        "ifdef-verbose": false,
    };
    return [
        {
            name: "core",
            entry: "../../src/core/index.ts",
            target: "node",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./tsconfig.json"),
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
                modules: [path.resolve("../../node_modules"), path.resolve("../../src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new webpack.DefinePlugin({
                    "process.env.CREATION_TIME": JSON.stringify(new Date().toISOString()),
                }),
            ],
            externals: {
                canvas: "commonjs canvas", // Important (2)
            },
            output: {
                path: path.join(__dirname, cliPath),
                filename: libName + ".node.js",
                library: libName + "-node",
                libraryTarget: "umd",
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        {
            name: "cli",
            entry: "../../src/cli/index.ts",
            target: "node",
            mode: mode,
            dependencies: ["core"],
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./tsconfig.json"),
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
                        test: /\.csv$/,
                        type: "asset/source",
                    },
                    {
                        test: /\.brs$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("../../node_modules"), path.resolve("../../src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [new ShebangPlugin()],
            externals: {
                "./brs.node.js": "commonjs ./brs.node.js",
                canvas: "commonjs canvas",
            },
            output: {
                filename: libName + ".cli.js",
                path: path.resolve(__dirname, cliPath),
            },
        },
        {
            name: "ecp",
            entry: "../../src/cli/ecp.ts",
            target: "node",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./tsconfig.json"),
                        },
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.tsx?$/,
                        loader: "ifdef-loader",
                        options: ifdef_opts,
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("../../node_modules"), path.resolve("../../src")],
                extensions: [".tsx", ".ts", ".js", ".mjs"],
            },
            externals: {
                bufferutil: "bufferutil",
                "utf-8-validate": "utf-8-validate",
            },
            output: {
                filename: libName + ".ecp.js",
                path: path.resolve(__dirname, cliPath),
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
                    path: "../../packages/node/assets",
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
