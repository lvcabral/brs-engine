const webpack = require("webpack");
const path = require("path");
const ShebangPlugin = require('webpack-shebang-plugin');

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
            entry: "./src/cli/index.ts",
            target: "node",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: "config/tsconfig.cli.json",
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
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new ShebangPlugin(),
            ],
            externals: {
                "./brs.node.js": "commonjs ./brs.node.js",
                canvas: "commonjs canvas"
            },
            output: {
                filename: libName + ".cli.js",
                path: path.resolve(__dirname, cliPath),
            },
        },
        {
            entry: "./src/core/index.ts",
            target: "node",
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
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                new webpack.DefinePlugin({
                    "process.env.CREATION_TIME": JSON.stringify(new Date().toISOString())
                })
            ],
            externals: {
                canvas: "commonjs canvas" // Important (2)
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
            entry: "./src/cli/ecp.ts",
            target: "node",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: "config/tsconfig.cli.json",
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
                modules: [path.resolve("./node_modules"), path.resolve("./src")],
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
    ];
};
