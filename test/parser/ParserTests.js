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
exports.token = function(kind, text, literal) {
    return {
        kind: kind,
        text: text,
        isReserved: brs.lexer.ReservedWords.has(text),
        literal: literal,
        location: {
            start: { line: -9, column: -9 },
            end: { line: -9, column: -9 },
        }
    };
}

/**
 * Creates an Identifier token with the given `text`.
 * @param {string} text
 * @returns {object} a token with the provided `text`.
 */
exports.identifier = function(text) {
    return exports.token(Lexeme.Identifier, text);
}

/** An end-of-file token. */
exports.EOF = exports.token(Lexeme.Eof, "\0");
