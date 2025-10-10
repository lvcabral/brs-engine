module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "prettier"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "project": ["tsconfig.json", './packages/*/tsconfig.json'],
        "sourceType": "module",
        "ecmaVersion": 2022
    },
    "plugins": [
        "eslint-plugin-import",
        "eslint-plugin-jsdoc",
        "@typescript-eslint"
    ],
    "root": true,
    "rules": {
        "@typescript-eslint/array-type": [
            "error",
            {
                "default": "array"
            }
        ],
        "@typescript-eslint/await-thenable": "error",
        "@typescript-eslint/consistent-type-assertions": "error",
        "@typescript-eslint/indent": "off",
        "@typescript-eslint/member-delimiter-style": [
            "off",
            {
                "multiline": {
                    "delimiter": "none",
                    "requireLast": true
                },
                "singleline": {
                    "delimiter": "semi",
                    "requireLast": false
                }
            }
        ],
        "@typescript-eslint/no-for-in-array": "error",
        "@typescript-eslint/no-var-requires": "error",
        "@typescript-eslint/prefer-for-of": "error",
        "@typescript-eslint/promise-function-async": "error",
        "@typescript-eslint/quotes": "off",
        "@typescript-eslint/restrict-plus-operands": "error",
        "@typescript-eslint/semi": [
            "off",
            null
        ],
        "@typescript-eslint/type-annotation-spacing": "off",
        "arrow-parens": [
            "off",
            "always"
        ],
        "brace-style": [
            "off",
            "off"
        ],
        "comma-dangle": "off",
        "eol-last": "off",
        "eqeqeq": [
            "error",
            "smart"
        ],
        "import/no-extraneous-dependencies": [
            "error",
            {
                "devDependencies": false
            }
        ],
        "indent": "off",
        "jsdoc/check-alignment": "error",
        "jsdoc/check-indentation": "off",
        "jsdoc/newline-after-description": "off",
        "linebreak-style": "off",
        "max-len": "off",
        "new-parens": "error",
        "newline-per-chained-call": "off",
        "no-debugger": "error",
        "no-extra-semi": "off",
        "no-fallthrough": "error",
        "no-irregular-whitespace": "off",
        "no-multiple-empty-lines": "off",
        "no-sequences": "error",
        "no-trailing-spaces": "off",
        "padded-blocks": [
            "off",
            {
                "blocks": "never"
            },
            {
                "allowSingleLineBlocks": true
            }
        ],
        "quote-props": "off",
        "quotes": "off",
        "react/jsx-curly-spacing": "off",
        "react/jsx-equals-spacing": "off",
        "react/jsx-tag-spacing": [
            "off",
            {
                "afterOpening": "allow",
                "closingSlash": "allow"
            }
        ],
        "react/jsx-wrap-multilines": "off",
        "semi": "off",
        "space-before-function-paren": "off",
        "space-in-parens": [
            "off",
            "never"
        ],
        "use-isnan": "error"
    }
};
