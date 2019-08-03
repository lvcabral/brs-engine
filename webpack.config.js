const path = require("path");

const isProduction = typeof NODE_ENV !== "undefined" && NODE_ENV === "production";
let outputFile, mode;
let libraryName = "brsLib";
if (isProduction) {
    mode = "production";
    outputFile = libraryName + ".min.js";
} else {
    mode = "development";
    outputFile = libraryName + ".js";
}
module.exports = [
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
        node: { fs: "empty", readline: "empty" },
        output: {
            path: path.join(__dirname, "lib"),
            filename: outputFile,
            library: libraryName,
            libraryTarget: "umd",
            umdNamedDefine: true,
            globalObject: "typeof self !== 'undefined' ? self : this",
        },
    },
];
