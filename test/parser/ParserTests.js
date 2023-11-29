const brs = require("brs");
const { Lexeme } = brs.lexer;

/* A set of utilities to be used while writing tests for the BRS parser. */

/**
 * Creates a token with the given `kind` and (optional) `literal` value.
 * @param {Lexeme} kind the lexeme the produced token should represent.
 * @param {string} text the text represented by this token.
 * @param {*} [literal] the literal value that the produced token should contain, if any
 * @returns {object} a token of `kind` representing `text` with value `literal`.
 */
exports.token = function (kind, text, literal) {
    return {
        kind: kind,
        text: text,
        isReserved: brs.lexer.ReservedWords.has((text || "").toLowerCase()),
        literal: literal,
        location: {
            start: { line: -9, column: -9 },
            end: { line: -9, column: -9 },
        },
    };
};

/**
 * Creates an Identifier token with the given `text`.
 * @param {string} text
 * @returns {object} a token with the provided `text`.
 */
exports.identifier = function (text) {
    return exports.token(Lexeme.Identifier, text);
};

/** An end-of-file token. */
exports.EOF = exports.token(Lexeme.Eof, "\0");

/**
 * Checks if two locations are equal
 * @param {object} location 1
 * @param {object} location 2
 */
exports.locationEqual = function (loc1, loc2) {
    return (
        loc1.start.line === loc2.start.line &&
        loc1.start.column === loc2.start.column &&
        loc1.end.line === loc2.end.line &&
        loc1.end.column === loc2.end.column
    );
};

/**
 * Removes least-common leading indentation from a string, effectively "unindenting" a multi-line
 * template string.
 * @param {string} str - the string to unindent
 * @return {string} `str`, but reformatted so that at least one line starts at column 0
 */
exports.deindent = function deindent(str) {
    let lines = str.split("\n");
    let firstNonEmptyLine = lines.find((line) => line.trim() !== "");
    if (firstNonEmptyLine == null) {
        return str;
    }

    let baseIndent = firstNonEmptyLine.length - firstNonEmptyLine.trim().length;
    return lines.map((line) => line.substring(baseIndent)).join("\n");
};
