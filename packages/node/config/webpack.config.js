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
    const scenegraphAlias = path.resolve(__dirname, "../../scenegraph", "src/index.ts");
    const sharedResolve = {
        modules: [path.resolve("../../node_modules"), path.resolve("../../src")],
        extensions: [".tsx", ".ts", ".js"],
        alias: {
            "brs-scenegraph$": scenegraphAlias,
        },
    };
    const tsLoaders = (configFile) => [
        {
            loader: "ts-loader",
            options: {
                configFile: path.resolve(__dirname, configFile),
            },
        },
        {
            loader: "ifdef-loader",
            options: ifdef_opts,
        },
    ];

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
                        use: tsLoaders("./tsconfig.json"),
                        exclude: /node_modules/,
                    },
                    {
                        test: /\.brs$/,
                        type: "asset/source",
                    },
                ],
            },
            resolve: sharedResolve,
            plugins: [
                new webpack.DefinePlugin({
                    "process.env.CREATION_TIME": JSON.stringify(new Date().toISOString()),
                }),
            ],
            externals: {
                "sharp-canvas": "commonjs sharp-canvas",
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
                        use: tsLoaders("./tsconfig.cli.json"),
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
            resolve: sharedResolve,
            plugins: [new ShebangPlugin()],
            externals: {
                "./brs.node.js": "commonjs ./brs.node.js",
                "brs-engine": "commonjs ./brs.node.js",
                "sharp-canvas": "commonjs sharp-canvas",
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
                        use: tsLoaders("./tsconfig.cli.json"),
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                ...sharedResolve,
                extensions: [".tsx", ".ts", ".js", ".mjs"],
            },
            externals: {
                bufferutil: "bufferutil",
                "utf-8-validate": "utf-8-validate",
                restana: "commonjs restana", // Don't bundle restana, let it resolve its own dependencies
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
