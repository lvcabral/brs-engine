const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env) => {
    return {
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
                path: "../../packages/browser/assets",
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
    };
};
