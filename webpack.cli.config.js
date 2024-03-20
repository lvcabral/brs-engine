const path = require("path");
const ShebangPlugin = require('webpack-shebang-plugin');

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs";
    let cliPath = "bin";
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
                            configFile: "tsconfig.cli.json",
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
                canvas: "commonjs canvas" // Important (2)
            },
            output: {
                filename: libName + ".cli.js",
                path: path.resolve(__dirname, cliPath),
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
                            configFile: "tsconfig.cli.json",
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
                extensions: [".tsx", ".ts", ".js"],
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
