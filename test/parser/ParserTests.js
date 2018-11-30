const { Lexeme } = require("brs");

/* A set of utilities to be used while writing tests for the BRS parser. */

/**
 * Creates a token with the given `kind` and (optional) `literal` value.
 * @param {Lexeme} kind the lexeme the produced token should represent.
 * @param {*} [literal] the literal value that the produced token should contain.
 * @returns {object} a token of `kind` with value `literal`.
 */
exports.token = function(kind, literal) {
    return {
        kind: kind,
        literal: literal,
        line: 1
    };
}

/**
 * Creates an Identifier token with the given `text`.
 * @param {string} text
 * @returns {object} a token with the provided `text`.
 */
exports.identifier = function(text) {
    return {
        kind: Lexeme.Identifier,
        text: text,
        line: 1
    };
}

/** An end-of-file token. */
exports.EOF = exports.token(Lexeme.Eof);
