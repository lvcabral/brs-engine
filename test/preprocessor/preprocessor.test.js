const brs = require("../../packages/node/bin/brs.node");
const { Preprocessor, Lexeme } = brs;
const { Chunk } = brs.preprocessor;
const { BrsString, BrsBoolean } = brs.types;

const { identifier, token, EOF } = require("../parser/ParserTests");

describe("preprocessor", () => {
    it("forwards brightscript chunk contents unmodified", () => {
        let unprocessed = [
            identifier("foo"),
            token(Lexeme.LeftParen, "("),
            token(Lexeme.RightParen, ")"),
            token(Lexeme.Newline, "\n"),
            EOF,
        ];

        let pp = new Preprocessor();
        let { processedTokens } = pp.filter([new Chunk.BrightScript(unprocessed)]);
        expect(processedTokens).toEqual(unprocessed);
    });

    describe("#const", () => {
        it("removes #const declarations from output", () => {
            let { processedTokens } = new Preprocessor().filter([
                new Chunk.Declaration(identifier("lorem"), token(Lexeme.False, "false", BrsBoolean.False)),
            ]);
            expect(processedTokens).toEqual([]);
        });

        describe("values", () => {
            it("allows `true`", () => {
                expect(() =>
                    new Preprocessor().filter([
                        new Chunk.Declaration(identifier("lorem"), token(Lexeme.True, "true", BrsBoolean.True)),
                    ])
                ).not.toThrow();
            });

            it("allows `false`", () => {
                expect(() =>
                    new Preprocessor().filter([
                        new Chunk.Declaration(identifier("ipsum"), token(Lexeme.False, "false", BrsBoolean.False)),
                    ])
                ).not.toThrow();
            });

            it("allows identifiers", () => {
                expect(() =>
                    new Preprocessor().filter([
                        // 'ipsum' must be defined before it's referenced
                        new Chunk.Declaration(identifier("ipsum"), token(Lexeme.False, "false", BrsBoolean.False)),
                        new Chunk.Declaration(identifier("dolor"), token(Lexeme.True, "true", BrsBoolean.True)),
                    ])
                ).not.toThrow();
            });

            it("disallows strings", () => {
                expect(() =>
                    new Preprocessor().filter([
                        new Chunk.Declaration(
                            identifier("sit"),
                            token(Lexeme.String, "good boy!", new BrsString("good boy!"))
                        ),
                    ])
                ).toThrow("#const declarations can only have");
            });

            it("disallows re-declaration of values", () => {
                expect(() =>
                    new Preprocessor().filter([
                        new Chunk.Declaration(identifier("lorem"), token(Lexeme.False, "false", BrsBoolean.False)),
                        new Chunk.Declaration(identifier("lorem"), token(Lexeme.True, "true", BrsBoolean.True)),
                    ])
                ).toThrow("Attempting to re-declare");
            });
        });
    });

    describe("#error", () => {
        it("throws error when #error directives encountered", () => {
            expect(() =>
                new Preprocessor().filter([new Chunk.Error(token(Lexeme.HashError, "#error"), "I'm an error message!")])
            ).toThrow();
        });

        it("doesn't throw when branched around", () => {
            expect(() =>
                new Preprocessor().filter([
                    new Chunk.If(
                        token(Lexeme.False, "false", BrsBoolean.False),
                        false, // not negated
                        [new Chunk.Error(token(Lexeme.HasError, "#error"), "I'm an error message!")],
                        [] // no else-ifs necessary
                    ),
                ])
            ).not.toThrow();
        });
    });

    describe("#if", () => {
        let ifChunk, elseIfChunk, elseChunk;

        beforeEach(() => {
            ifChunk = new Chunk.BrightScript([]);
            elseIfChunk = new Chunk.BrightScript([]);
            elseChunk = new Chunk.BrightScript([]);

            jest.spyOn(ifChunk, "accept");
            jest.spyOn(elseIfChunk, "accept");
            jest.spyOn(elseChunk, "accept");
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        it("enters #if branch", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.True, "true", BrsBoolean.True),
                    false, // not negated
                    [ifChunk],
                    [
                        {
                            condition: token(Lexeme.True, "true", BrsBoolean.True),
                            isNegated: false,
                            thenChunks: [elseIfChunk],
                        },
                    ],
                    [elseChunk]
                ),
            ]);

            expect(ifChunk.accept).toHaveBeenCalledTimes(1);
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("enters #else if branch", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.False, "false", BrsBoolean.False),
                    false, // not negated
                    [ifChunk],
                    [
                        {
                            condition: token(Lexeme.True, "true", BrsBoolean.True),
                            isNegated: false,
                            thenChunks: [elseIfChunk],
                        },
                    ],
                    [elseChunk]
                ),
            ]);

            expect(ifChunk.accept).not.toHaveBeenCalled();
            expect(elseIfChunk.accept).toHaveBeenCalledTimes(1);
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("enters #else branch", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.False, "false", BrsBoolean.False),
                    false, // not negated
                    [ifChunk],
                    [
                        {
                            condition: token(Lexeme.False, "false", BrsBoolean.False),
                            isNegated: false,
                            thenChunks: [elseIfChunk],
                        },
                    ],
                    [elseChunk]
                ),
            ]);

            expect(ifChunk.accept).not.toHaveBeenCalled();
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).toHaveBeenCalledTimes(1);
        });

        it("enters no branches if none pass", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.False, "false", BrsBoolean.False),
                    false, // not negated
                    [ifChunk],
                    [] // no else-if chunks
                    // NOTE: no 'else" chunk!
                ),
            ]);

            expect(ifChunk.accept).not.toHaveBeenCalled();
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("uses #const values to determine truth", () => {
            new Preprocessor().filter([
                new Chunk.Declaration(identifier("lorem"), token(Lexeme.True, "true", BrsBoolean.True)),
                new Chunk.If(
                    identifier("lorem"),
                    false, // not negated
                    [ifChunk],
                    [] // no else-if chunks
                    // NOTE: no 'else" chunk!
                ),
            ]);

            expect(ifChunk.accept).toHaveBeenCalledTimes(1);
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("negates true condition with 'not'", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.True, "true", BrsBoolean.True),
                    true, // negated
                    [ifChunk],
                    [] // no else-if chunks
                    // NOTE: no 'else" chunk!
                ),
            ]);

            expect(ifChunk.accept).not.toHaveBeenCalled();
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("negates false condition with 'not'", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.False, "false", BrsBoolean.False),
                    true, // negated
                    [ifChunk],
                    [] // no else-if chunks
                    // NOTE: no 'else" chunk!
                ),
            ]);

            expect(ifChunk.accept).toHaveBeenCalledTimes(1);
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("negates #const identifier with 'not'", () => {
            new Preprocessor().filter([
                new Chunk.Declaration(identifier("lorem"), token(Lexeme.True, "true", BrsBoolean.True)),
                new Chunk.If(
                    identifier("lorem"),
                    true, // negated
                    [ifChunk],
                    [] // no else-if chunks
                    // NOTE: no 'else" chunk!
                ),
            ]);

            expect(ifChunk.accept).not.toHaveBeenCalled();
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });

        it("enters #else if branch with negated condition", () => {
            new Preprocessor().filter([
                new Chunk.If(
                    token(Lexeme.True, "true", BrsBoolean.True),
                    false, // not negated
                    [ifChunk],
                    [
                        {
                            condition: token(Lexeme.True, "true", BrsBoolean.True),
                            isNegated: true, // negated
                            thenChunks: [elseIfChunk],
                        },
                    ],
                    [elseChunk]
                ),
            ]);

            expect(ifChunk.accept).toHaveBeenCalledTimes(1);
            expect(elseIfChunk.accept).not.toHaveBeenCalled();
            expect(elseChunk.accept).not.toHaveBeenCalled();
        });
    });
});
