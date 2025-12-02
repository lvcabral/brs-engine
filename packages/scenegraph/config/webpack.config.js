const webpack = require("webpack");
const path = require("node:path");

module.exports = (env) => {
    let mode, sourceMap;
    let libName = "brs-scenegraph";
    let distPath = "../lib";

    if (env.production) {
        mode = "production";
        sourceMap = false;
    } else {
        mode = "development";
        sourceMap = "inline-cheap-module-source-map";
    }

    return [
        // Node bundle - uses brs-engine as external (will resolve to brs-node at runtime)
        {
            name: "node",
            entry: path.resolve(__dirname, "../../../src/extensions/scenegraph/index.ts"),
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
                            compilerOptions: {
                                declaration: false,
                                declarationMap: false,
                                emitDeclarationOnly: false,
                            },
                        },
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("../../node_modules")],
                extensions: [".tsx", ".ts", ".js"],
            },
            plugins: [
                {
                    apply: (compiler) => {
                        compiler.hooks.afterEmit.tap("CopyToNodePackage", () => {
                            const fs = require("fs");
                            const sourcePath = path.resolve(__dirname, distPath, "brs-sg.node.js");
                            const destPath = path.resolve(__dirname, "../../node/bin/brs-sg.node.js");
                            if (fs.existsSync(sourcePath)) {
                                fs.copyFileSync(sourcePath, destPath);
                            }
                        });
                    },
                },
            ],
            externals: {
                "brs-engine": "commonjs brs-node",
                xmldoc: "commonjs xmldoc",
            },
            output: {
                path: path.join(__dirname, distPath),
                filename: "brs-sg.node.js",
                library: {
                    name: libName,
                    type: "umd",
                },
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
        // Browser bundle - uses brs-engine as external (expects it in global scope)
        {
            name: "browser",
            entry: path.resolve(__dirname, "../../../src/extensions/scenegraph/index.ts"),
            target: "web",
            mode: mode,
            devtool: sourceMap,
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: "ts-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./tsconfig.json"),
                            compilerOptions: {
                                declaration: false,
                                declarationMap: false,
                                emitDeclarationOnly: false,
                            },
                        },
                        exclude: /node_modules/,
                    },
                ],
            },
            resolve: {
                modules: [path.resolve("../../node_modules")],
                extensions: [".tsx", ".ts", ".js"],
                fallback: {
                    path: require.resolve("path-browserify"),
                    "process/browser": require.resolve("process/browser"),
                },
            },
            plugins: [
                new webpack.ProvidePlugin({
                    process: "process/browser",
                }),
                // Copy the SceneGraph library to the output directory
                {
                    apply: (compiler) => {
                        compiler.hooks.afterEmit.tap("CopyToBrowserPackage", () => {
                            const fs = require("fs");
                            const sourcePath = path.resolve(__dirname, distPath, "brs-sg.js");
                            const destPath = path.resolve(__dirname, "../../browser/lib/brs-sg.js");
                            if (fs.existsSync(sourcePath)) {
                                fs.copyFileSync(sourcePath, destPath);
                            }
                        });
                    },
                },
            ],
            externals: {
                // Reference brs-engine from global scope (it's already loaded in the worker)
                "brs-engine": "root brsEngine",
                // xmldoc is bundled in the worker, so we reference it from global
                xmldoc: "root xmldoc",
            },
            output: {
                path: path.join(__dirname, distPath),
                filename: "brs-sg.js",
                library: {
                    name: libName,
                    type: "umd",
                },
                umdNamedDefine: true,
                globalObject: "typeof self !== 'undefined' ? self : this",
            },
        },
    ];
};
