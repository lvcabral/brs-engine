import { EventEmitter } from "events";

import * as Expr from "./Expression";
type Expression = Expr.Expression;
import * as Stmt from "./Statement";
type Statement = Stmt.Statement;
import { Lexeme, Token, Identifier, Location, ReservedWords } from "../lexer";
import { ParseError } from "./ParseError";

import { BrsInvalid, BrsBoolean, BrsString, Int32, ValueKind, Argument, StdlibArgument, BrsType } from "../brsTypes";
import { RuntimeErrorDetail } from "../error/BrsError";

/** Set of all keywords that end blocks. */
type BlockTerminator =
    | Lexeme.ElseIf
    | Lexeme.Else
    | Lexeme.EndFor
    | Lexeme.Next
    | Lexeme.EndIf
    | Lexeme.EndWhile
    | Lexeme.EndSub
    | Lexeme.EndFunction
    | Lexeme.Newline // possible only in a single-line `if` statement
    | Lexeme.Eof // possible only in a single-line `if` statement
    | Lexeme.Catch
    | Lexeme.EndTry;

/** The set of operators valid for use in assignment statements. */
const assignmentOperators = [
    Lexeme.Equal,
    Lexeme.MinusEqual,
    Lexeme.PlusEqual,
    Lexeme.StarEqual,
    Lexeme.SlashEqual,
    Lexeme.BackslashEqual,
    Lexeme.LeftShiftEqual,
    Lexeme.RightShiftEqual,
];

/** List of Lexemes that are permitted as property names. */
const allowedProperties = [
    Lexeme.And,
    Lexeme.Box,
    Lexeme.Catch,
    Lexeme.ContinueFor,
    Lexeme.ContinueWhile,
    Lexeme.CreateObject,
    Lexeme.Dim,
    Lexeme.Else,
    Lexeme.ElseIf,
    Lexeme.End,
    Lexeme.EndFunction,
    Lexeme.EndFor,
    Lexeme.EndIf,
    Lexeme.EndSub,
    Lexeme.EndWhile,
    Lexeme.Eval,
    Lexeme.Exit,
    Lexeme.ExitFor,
    Lexeme.ExitWhile,
    Lexeme.False,
    Lexeme.For,
    Lexeme.ForEach,
    Lexeme.Function,
    Lexeme.GetGlobalAA,
    Lexeme.GetLastRunCompileError,
    Lexeme.GetLastRunRunTimeError,
    Lexeme.Goto,
    Lexeme.If,
    Lexeme.Invalid,
    Lexeme.Let,
    Lexeme.Mod,
    Lexeme.Next,
    Lexeme.Not,
    Lexeme.ObjFun,
    Lexeme.Or,
    Lexeme.Pos,
    Lexeme.Print,
    Lexeme.Rem,
    Lexeme.Return,
    Lexeme.Step,
    Lexeme.Stop,
    Lexeme.Sub,
    Lexeme.Tab,
    Lexeme.To,
    Lexeme.True,
    Lexeme.Try,
    Lexeme.Type,
    Lexeme.While,
];

/** List of Lexeme that are allowed as local var identifiers. */
const allowedIdentifiers = [Lexeme.EndFor, Lexeme.ExitFor, Lexeme.ForEach, Lexeme.Try, Lexeme.Catch];

/**
 * List of string versions of Lexeme that are NOT allowed as local var identifiers.
 * Used to throw more helpful "you can't use a reserved word as an identifier" errors.
 */
const disallowedIdentifiers = new Set(
    [
        Lexeme.And,
        Lexeme.Box,
        Lexeme.CreateObject,
        Lexeme.Dim,
        Lexeme.Else,
        Lexeme.ElseIf,
        Lexeme.End,
        Lexeme.EndFunction,
        Lexeme.EndIf,
        Lexeme.EndSub,
        Lexeme.EndWhile,
        Lexeme.Eval,
        Lexeme.Exit,
        Lexeme.ExitWhile,
        Lexeme.False,
        Lexeme.For,
        Lexeme.Function,
        Lexeme.GetGlobalAA,
        Lexeme.GetLastRunCompileError,
        Lexeme.GetLastRunRunTimeError,
        Lexeme.Goto,
        Lexeme.If,
        Lexeme.Invalid,
        Lexeme.Let,
        Lexeme.Next,
        Lexeme.Not,
        Lexeme.ObjFun,
        Lexeme.Or,
        Lexeme.Pos,
        Lexeme.Print,
        Lexeme.Rem,
        Lexeme.Return,
        Lexeme.Step,
        Lexeme.Sub,
        Lexeme.Tab,
        Lexeme.To,
        Lexeme.True,
        Lexeme.Type,
        Lexeme.While,
    ].map((x) => Lexeme[x].toLowerCase())
);

const bsLibraries = new Map<string, boolean>();

/** The results of a Parser's parsing pass. */
export interface ParseResults {
    /** The statements produced by the parser. */
    statements: Stmt.Statement[];
    /** The errors encountered by the Parser. */
    errors: ParseError[];
    /** Libraries usage encountered by the Parser */
    libraries: Map<string, boolean>;
}

export class Parser {
    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();
    readonly stats = new Map<Lexeme, Set<any>>();

    constructor() {
        bsLibraries.set("v30/bslCore.brs", false);
        bsLibraries.set("v30/bslDefender.brs", false);
        bsLibraries.set("Roku_Ads.brs", false);
        bsLibraries.set("IMA3.brs", false);
        bsLibraries.set("Roku_Event_Dispatcher.brs", false);
        bsLibraries.set("RokuBrowser.brs", false);
        this.stats.set(Lexeme.Integer, new Set());
        this.stats.set(Lexeme.String, new Set());
        this.stats.set(Lexeme.Float, new Set());
        this.stats.set(Lexeme.Double, new Set());
        this.stats.set(Lexeme.LongInteger, new Set());
        this.stats.set(Lexeme.Function, new Set());
        this.stats.set(Lexeme.Identifier, new Set());
    }

    /**
     * A convenience function, equivalent to `new Parser().parse(toParse)`, that parses an array of
     * `Token`s into an abstract syntax tree that can be executed with the `Interpreter`.
     * @param toParse the array of tokens to parse
     * @returns an array of `Statement` objects that together form the abstract syntax tree of the
     *          program
     */
    static parse(toParse: readonly Token[]) {
        return new Parser().parse(toParse);
    }

    /**
     * Convenience function to subscribe to the `err` events emitted by `parser.events`.
     * @param errorHandler the function to call for every Parser error emitted after subscribing
     * @returns an object with a `dispose` function, used to unsubscribe from errors
     */
    public onError(errorHandler: (err: ParseError) => void) {
        this.events.on("err", errorHandler);
        return {
            dispose: () => {
                this.events.removeListener("err", errorHandler);
            },
        };
    }

    /**
     * Convenience function to subscribe to a single `err` event emitted by `parser.events`.
     * @param errorHandler the function to call for the first Parser error emitted after subscribing
     */
    public onErrorOnce(errorHandler: (err: ParseError) => void) {
        this.events.once("err", errorHandler);
    }

    /**
     * Parses an array of `Token`s into an abstract syntax tree that can be executed with the `Interpreter`.
     * @param toParse the array of tokens to parse
     * @returns an array of `Statement` objects that together form the abstract syntax tree of the
     *          program
     */
    parse(toParse: readonly Token[]): ParseResults {
        const self = this;
        let current = 0;
        let tokens = toParse;
        let parsingTryBlock = false;

        //the depth of the calls to function declarations. Helps some checks know if they are at the root or not.
        let functionDeclarationLevel = 0;

        function isAtRootLevel() {
            return functionDeclarationLevel === 0;
        }

        let statements: Statement[] = [];

        let errors: ParseError[] = [];

        /**
         * Add an error to the parse results.
         * @param token - the token where the error occurred
         * @param message - the message for this error
         * @returns an error object that can be thrown if the calling code needs to abort parsing
         */
        const addError = (token: Token, message: string) => {
            let err = new ParseError(token, message);
            errors.push(err);
            this.events.emit("err", err);
            return err;
        };

        /**
         * Add an error at the given location.
         * @param location
         * @param message
         */
        const addErrorAtLocation = (location: Location, message: string) => {
            addError({ location: location } as any, message);
        };

        if (toParse.length === 0) {
            return {
                statements: [],
                errors: [],
                libraries: bsLibraries,
            };
        }

        try {
            while (!isAtEnd()) {
                let dec = declaration();
                if (dec) {
                    statements.push(dec);
                }
            }

            return { statements, errors, libraries: bsLibraries };
        } catch (parseError) {
            return {
                statements: [],
                errors: errors,
                libraries: bsLibraries,
            };
        }

        function declaration(...additionalTerminators: BlockTerminator[]): Statement | undefined {
            try {
                let statementSeparators = [Lexeme.Colon];

                if (additionalTerminators.includes(Lexeme.Newline)) {
                    // if this declaration can be terminated with a newline, check for one
                    // before other statement separators
                    if (check(Lexeme.Newline)) {
                        return;
                    }
                } else {
                    statementSeparators.push(Lexeme.Newline);
                }

                while (match(...statementSeparators));

                if (additionalTerminators.includes(Lexeme.Newline)) {
                    // if this declaration can be terminated with a newline, check for one
                    // _after_ a series of `:`s.
                    if (check(Lexeme.Newline)) {
                        return;
                    }
                }

                // if we reached the end, don't attempt to do anything else
                if (isAtEnd()) {
                    return;
                }

                try {
                    if (functionDeclarationLevel === 0 && check(Lexeme.Sub, Lexeme.Function)) {
                        return functionDeclaration(false);
                    }

                    if (checkLibrary()) {
                        return libraryStatement();
                    }

                    // BrightScript is like python, in that variables can be declared without a `var`,
                    // `let`, (...) keyword. As such, we must check the token *after* an identifier to figure
                    // out what to do with it.
                    if (check(Lexeme.Identifier, ...allowedIdentifiers) && checkNext(...assignmentOperators)) {
                        return assignment(...additionalTerminators);
                    }

                    return statement(...additionalTerminators);
                } finally {
                    while (match(...statementSeparators));
                }
            } catch (error) {
                synchronize();
                return;
            }
        }

        function functionDeclaration(isAnonymous: true): Expr.Function;
        function functionDeclaration(isAnonymous: false): Stmt.Function;
        function functionDeclaration(isAnonymous: boolean) {
            try {
                //certain statements need to know if they are contained within a function body
                //so track the depth here
                functionDeclarationLevel++;
                let startingKeyword = peek();
                let isSub = check(Lexeme.Sub);
                let functionType = advance();
                let name: Identifier;
                let returnType: ValueKind;
                let leftParen: Token;
                let rightParen: Token;

                if (isSub) {
                    returnType = ValueKind.Void;
                } else {
                    returnType = ValueKind.Dynamic;
                }

                let funcName = "(anonymous)";
                if (isAnonymous) {
                    leftParen = consume(`Expected '(' after ${functionType.text}`, Lexeme.LeftParen);
                } else {
                    name = consume(
                        `Expected ${functionType.text} name after '${functionType.text}'`,
                        Lexeme.Identifier
                    ) as Identifier;
                    leftParen = consume(`Expected '(' after ${functionType.text} name`, Lexeme.LeftParen);

                    //prevent functions from ending with type designators
                    let lastChar = name.text[name.text.length - 1];
                    if (["$", "%", "!", "#", "&"].includes(lastChar)) {
                        //don't throw this error; let the parser continue
                        addError(name, `Function name '${name.text}' cannot end with type designator '${lastChar}'`);
                    }
                    funcName = name.text;
                }

                let args: Argument[] = [];
                if (!check(Lexeme.RightParen)) {
                    do {
                        if (args.length >= Expr.Call.MaximumArguments) {
                            throw addError(peek(), `Cannot have more than ${Expr.Call.MaximumArguments} arguments`);
                        }

                        args.push(signatureArgument());
                    } while (match(Lexeme.Comma));
                }
                rightParen = advance();

                let maybeAs = peek();
                if (check(Lexeme.Identifier) && maybeAs.text.toLowerCase() === "as") {
                    advance();

                    let typeToken = advance();
                    let typeString = typeToken.text || "";
                    let maybeReturnType = ValueKind.fromString(typeString);

                    if (!maybeReturnType) {
                        throw addError(typeToken, `Function return type '${typeString}' is invalid`);
                    }
                    // RBI count the literal integer 0 when a function has a return type
                    countLiteral(Lexeme.Integer, new Int32(0));
                    returnType = maybeReturnType;
                }

                args.reduce((haveFoundOptional: boolean, arg: Argument) => {
                    if (haveFoundOptional && !arg.defaultValue) {
                        throw addError(
                            {
                                kind: Lexeme.Identifier,
                                text: arg.name.text,
                                isReserved: ReservedWords.has(arg.name.text),
                                location: arg.location,
                            },
                            `Argument '${arg.name.text}' has no default value, but comes after arguments with default values`
                        );
                    }

                    return haveFoundOptional || !!arg.defaultValue;
                }, false);

                checkOrThrow(
                    `Expected newline or ':' after ${functionType.text} signature`,
                    Lexeme.Newline,
                    Lexeme.Colon
                );
                //support ending the function with `end sub` OR `end function`
                let maybeBody = block(Lexeme.EndSub, Lexeme.EndFunction);
                if (!maybeBody) {
                    throw addError(
                        peek(),
                        `Expected 'end ${functionType.text}' to terminate ${functionType.text} block`
                    );
                }
                let endingKeyword = maybeBody.closingToken;
                let expectedEndKind = isSub ? Lexeme.EndSub : Lexeme.EndFunction;

                //if `function` is ended with `end sub`, or `sub` is ended with `end function`, then
                //add an error but don't hard-fail so the AST can continue more gracefully
                if (endingKeyword.kind !== expectedEndKind) {
                    addError(
                        endingKeyword,
                        `Expected 'end ${functionType.text}' to terminate ${functionType.text} block`
                    );
                }

                let func = new Expr.Function(args, returnType, maybeBody.body, startingKeyword, endingKeyword);
                countFunction(funcName);

                if (isAnonymous) {
                    return func;
                } else {
                    // only consume trailing newlines in the statement context; expressions
                    // expect to handle their own trailing whitespace
                    while (match(Lexeme.Newline));
                    return new Stmt.Function(name!, func);
                }
            } finally {
                functionDeclarationLevel--;
            }
        }

        function signatureArgument(): Argument {
            if (!check(Lexeme.Identifier)) {
                throw addError(peek(), `Expected argument name, but received '${peek().text || ""}'`);
            }

            let name = advance();
            let type: ValueKind = ValueKind.Dynamic;
            let typeToken: Token | undefined;
            let defaultValue;

            // parse argument default value
            if (match(Lexeme.Equal)) {
                // it seems any expression is allowed here -- including ones that operate on other arguments!
                defaultValue = expression();
            }

            let next = peek();
            if (check(Lexeme.Identifier) && next.text && next.text.toLowerCase() === "as") {
                // 'as' isn't a reserved word, so it can't be lexed into an As token without the lexer
                // understanding language context.  That's less than ideal, so we'll have to do some
                // more intelligent comparisons to detect the 'as' sometimes-keyword here.
                advance();

                typeToken = advance();
                let typeValueKind = ValueKind.fromString(typeToken.text);

                if (!typeValueKind) {
                    throw addError(
                        typeToken,
                        `Function parameter '${name.text}' is of invalid type '${typeToken.text}'`
                    );
                }

                type = typeValueKind;
            }

            return {
                name: name,
                type: {
                    kind: type,
                    location: typeToken ? typeToken.location : StdlibArgument.InternalLocation,
                },
                defaultValue: defaultValue,
                location: {
                    file: name.location.file,
                    start: name.location.start,
                    end: typeToken ? typeToken.location.end : name.location.end,
                },
            };
        }

        function assignment(...additionalTerminators: Lexeme[]): Stmt.Assignment {
            let name = advance() as Identifier;
            //add error if name is a reserved word that cannot be used as an identifier
            if (disallowedIdentifiers.has(name.text.toLowerCase())) {
                //don't throw...this is fully recoverable
                addError(name, `Cannot use reserved word "${name.text}" as an identifier`);
            }
            let operator = consume(
                `Expected operator ('=', '+=', '-=', '*=', '/=', '\\=', '^=', '<<=', or '>>=') after identifier '${name.text}'`,
                ...assignmentOperators
            );

            let value = expression();
            if (!check(...additionalTerminators)) {
                consume(
                    "Expected newline or ':' after assignment",
                    Lexeme.Newline,
                    Lexeme.Colon,
                    Lexeme.Eof,
                    ...additionalTerminators
                );
            }

            if (operator.kind === Lexeme.Equal) {
                return new Stmt.Assignment({ equals: operator }, name, value);
            } else {
                return new Stmt.Assignment(
                    { equals: operator },
                    name,
                    new Expr.Binary(new Expr.Variable(name), operator, value)
                );
            }
        }

        function checkLibrary() {
            let isLibraryIdentifier = check(Lexeme.Identifier) && peek().text.toLowerCase() === "library";
            //if we are at the top level, any line that starts with "library" should be considered a library statement
            if (isAtRootLevel() && isLibraryIdentifier) {
                return true;
            }
            //not at root level, library statements are all invalid here, but try to detect if the tokens look
            //like a library statement (and let the libraryStatement function handle emitting the errors)
            else if (isLibraryIdentifier && checkNext(Lexeme.String)) {
                return true;
            }
            //definitely not a library statement
            else {
                return false;
            }
        }

        function statement(...additionalTerminators: BlockTerminator[]): Statement | undefined {
            if (checkLibrary()) {
                return libraryStatement();
            }

            if (check(Lexeme.Stop)) {
                return stopStatement();
            }

            if (check(Lexeme.Try)) {
                return tryCatch();
            }

            if (check(Lexeme.If)) {
                return ifStatement();
            }

            if (check(Lexeme.Print)) {
                return printStatement(...additionalTerminators);
            }

            if (check(Lexeme.While)) {
                return whileStatement();
            }

            if (check(Lexeme.ContinueWhile)) {
                return continueWhile();
            }

            if (check(Lexeme.ExitWhile)) {
                return exitWhile();
            }

            if (check(Lexeme.For)) {
                return forStatement();
            }

            if (check(Lexeme.ForEach)) {
                return forEachStatement();
            }

            if (check(Lexeme.ContinueFor)) {
                return continueFor();
            }

            if (check(Lexeme.ExitFor)) {
                return exitFor();
            }

            if (check(Lexeme.End)) {
                return endStatement();
            }

            if (match(Lexeme.Return)) {
                return returnStatement();
            }

            if (match(Lexeme.Throw)) {
                return throwStatement();
            }

            if (check(Lexeme.Dim)) {
                return dimStatement();
            }

            if (check(Lexeme.Goto)) {
                return gotoStatement();
            }

            //does this line look like a label? (i.e.  `someIdentifier:` )
            if ((check(Lexeme.Identifier) || check(Lexeme.Integer)) && checkNext(Lexeme.Colon)) {
                return labelStatement();
            }

            // TODO: support multi-statements
            return setStatement(...additionalTerminators);
        }

        function tryCatch(): Stmt.TryCatch {
            let tryKeyword = advance();
            parsingTryBlock = true;
            let tryBlock = block(Lexeme.Catch);
            parsingTryBlock = false;
            if (!tryBlock) {
                throw addError(peek(), "Expected 'catch' to terminate try block");
            }

            if (!check(Lexeme.Identifier)) {
                // defer this error so we can parse the `catch` block.
                // it'll be thrown if the catch block parses successfully otherwise.
                throw addError(peek(), "Expected variable name for caught error after 'catch'");
            }

            let caughtVariable = new Expr.Variable(advance() as Identifier);
            let catchBlock = block(Lexeme.EndTry);
            if (!catchBlock) {
                throw addError(peek(), "Expected 'end try' or 'endtry' to terminate catch block");
            }

            return new Stmt.TryCatch(tryBlock.body, catchBlock.body, caughtVariable, {
                try: tryKeyword,
                catch: tryBlock.closingToken,
                endtry: catchBlock.closingToken,
            });
        }

        function whileStatement(): Stmt.While {
            const whileKeyword = advance();
            const condition = expression();

            checkOrThrow("Expected newline or ':' after 'while ...condition...'", Lexeme.Newline, Lexeme.Colon);
            const maybeWhileBlock = block(Lexeme.EndWhile);
            if (!maybeWhileBlock) {
                throw addError(peek(), "Expected 'end while' to terminate while-loop block");
            }

            return new Stmt.While(
                { while: whileKeyword, endWhile: maybeWhileBlock.closingToken },
                condition,
                maybeWhileBlock.body
            );
        }

        function continueWhile(): Stmt.ContinueWhile {
            let keyword = advance();
            checkOrThrow("Expected newline after 'continue while'", Lexeme.Newline);
            return new Stmt.ContinueWhile({ continueWhile: keyword });
        }

        function exitWhile(): Stmt.ExitWhile {
            let keyword = advance();
            checkOrThrow("Expected newline after 'exit while'", Lexeme.Newline);
            return new Stmt.ExitWhile({ exitWhile: keyword });
        }

        function forStatement(): Stmt.For {
            const forKeyword = advance();
            const initializer = assignment(Lexeme.To);
            const to = advance();
            const finalValue = expression();
            let increment: Expression | undefined;
            let step: Token | undefined;

            if (check(Lexeme.Step)) {
                step = advance();
                increment = expression();
            } else {
                // BrightScript for/to/step loops default to a step of 1 if no `step` is provided
                increment = new Expr.Literal(new Int32(1), peek().location);
            }
            // RBI count the step as literal integer even when omitted
            if (increment instanceof Expr.Literal) {
                countLiteral(Lexeme.Integer, increment.value);
            }

            let maybeBody = block(Lexeme.EndFor, Lexeme.Next);
            if (!maybeBody) {
                throw addError(peek(), "Expected 'end for' or 'next' to terminate for-loop block");
            }

            // WARNING: BrightScript doesn't delete the loop initial value after a for/to loop! It just
            // stays around in scope with whatever value it was when the loop exited.
            return new Stmt.For(
                {
                    for: forKeyword,
                    to: to,
                    step: step,
                    endFor: maybeBody.closingToken,
                },
                initializer,
                finalValue,
                increment,
                maybeBody.body
            );
        }

        function forEachStatement(): Stmt.ForEach {
            let forEach = advance();
            let name = advance();

            let maybeIn = peek();
            if (check(Lexeme.Identifier) && maybeIn.text.toLowerCase() === "in") {
                advance();
            } else {
                throw addError(maybeIn, "Expected 'in' after 'for each <name>'");
            }

            let target = expression();
            if (!target) {
                throw addError(peek(), "Expected target object to iterate over");
            }
            advance();

            let maybeBody = block(Lexeme.EndFor, Lexeme.Next);
            if (!maybeBody) {
                throw addError(peek(), "Expected 'end for' or 'next' to terminate for-loop block");
            }

            return new Stmt.ForEach(
                {
                    forEach: forEach,
                    in: maybeIn,
                    endFor: maybeBody.closingToken,
                },
                name,
                target,
                maybeBody.body
            );
        }

        function continueFor(): Stmt.ContinueFor {
            let keyword = advance();
            checkOrThrow("Expected newline after 'continue for'", Lexeme.Newline);
            return new Stmt.ContinueFor({ continueFor: keyword });
        }

        function exitFor(): Stmt.ExitFor {
            let keyword = advance();
            checkOrThrow("Expected newline after 'exit for'", Lexeme.Newline);
            return new Stmt.ExitFor({ exitFor: keyword });
        }

        function libraryStatement(): Stmt.Library | undefined {
            let libraryStatement = new Stmt.Library({
                library: advance(),
                //grab the next token only if it's a string
                filePath: check(Lexeme.String) ? advance() : undefined,
            });

            //no token following library keyword token
            if (!libraryStatement.tokens.filePath && check(Lexeme.Newline, Lexeme.Colon)) {
                addErrorAtLocation(
                    libraryStatement.tokens.library.location,
                    `Missing string literal after ${libraryStatement.tokens.library.text} keyword`
                );
            }
            //does not have a string literal as next token
            else if (!libraryStatement.tokens.filePath && peek().kind === Lexeme.Newline) {
                addErrorAtLocation(
                    peek().location,
                    `Expected string literal after ${libraryStatement.tokens.library.text} keyword`
                );
            }

            //consume all tokens until the end of the line
            let invalidTokens = consumeUntil(Lexeme.Newline, Lexeme.Eof, Lexeme.Colon);

            if (invalidTokens.length > 0) {
                //add an error for every invalid token
                for (let invalidToken of invalidTokens) {
                    addErrorAtLocation(
                        invalidToken.location,
                        `Found unexpected token '${invalidToken.text}' after library statement`
                    );
                }
            }

            //libraries must be at the very top of the file before any other declarations.
            let isAtTopOfFile = true;
            for (let statement of statements) {
                //if we found a non-library statement, this statement is not at the top of the file
                if (!(statement instanceof Stmt.Library)) {
                    isAtTopOfFile = false;
                }
            }

            //libraries must be a root-level statement (i.e. NOT nested inside of functions)
            if (!isAtRootLevel() || !isAtTopOfFile) {
                addErrorAtLocation(
                    libraryStatement.location,
                    "Library statements may only appear at the top of a file"
                );
            }
            //consume to the next newline, eof, or colon
            while (match(Lexeme.Newline, Lexeme.Eof, Lexeme.Colon));

            //flag library usage
            let path = libraryStatement.tokens.filePath;
            if (path) {
                let key = path.text.slice(1, path.text.length - 1);
                if (bsLibraries.has(key)) {
                    bsLibraries.set(key, true);
                } else {
                    addErrorAtLocation(
                        libraryStatement.location,
                        `Invalid library "${key}"! Supported: ${Array.from(bsLibraries.keys()).join(", ")}`
                    );
                }
            }
            return libraryStatement;
        }

        function ifStatement(): Stmt.If {
            const ifToken = advance();
            const startingLine = ifToken.location;

            const condition = expression();
            let thenBranch: Stmt.Block;
            let elseIfBranches: Stmt.ElseIf[] = [];
            let elseBranch: Stmt.Block | undefined;

            let thenToken: Token | undefined;
            let elseIfTokens: Token[] = [];
            let endIfToken: Token | undefined;
            let elseToken: Token | undefined;

            /**
             * A simple wrapper around `check`, to make tests for a `then` identifier.
             * As with many other words, "then" is a keyword but not reserved, so associative
             * arrays can have properties called "then".  It's a valid identifier sometimes, so the
             * parser has to take on the burden of understanding that I guess.
             * @returns `true` if the next token is an identifier with text "then", otherwise `false`.
             */
            function checkThen() {
                return check(Lexeme.Identifier) && peek().text.toLowerCase() === "then";
            }

            if (checkThen()) {
                // `then` is optional after `if ...condition...`, so only advance to the next token if `then` is present
                thenToken = advance();
            }

            if (check(Lexeme.Newline) || check(Lexeme.Colon)) {
                //keep track of the current error count, because if the then branch fails,
                //we will trash them in favor of a single error on if
                let errorsLengthBeforeBlock = errors.length;

                // we're parsing a multi-line ("block") form of the BrightScript if/then/else and must find
                // a trailing "end if"

                let maybeThenBranch = block(Lexeme.EndIf, Lexeme.Else, Lexeme.ElseIf);
                if (!maybeThenBranch) {
                    //throw out any new errors created as a result of a `then` block parse failure.
                    //the block() function will discard the current line, so any discarded errors will
                    //resurface if they are legitimate, and not a result of a malformed if statement
                    errors.splice(errorsLengthBeforeBlock, errors.length - errorsLengthBeforeBlock);

                    //this whole if statement is bogus...add error to the if token and hard-fail
                    throw addError(ifToken, "Expected 'end if', 'else if', or 'else' to terminate 'then' block");
                }

                let blockEnd = maybeThenBranch.closingToken;
                if (blockEnd.kind === Lexeme.EndIf) {
                    endIfToken = blockEnd;
                }

                thenBranch = maybeThenBranch.body;

                // attempt to read a bunch of "else if" clauses
                while (blockEnd.kind === Lexeme.ElseIf) {
                    elseIfTokens.push(blockEnd);
                    let elseIfCondition = expression();
                    if (checkThen()) {
                        // `then` is optional after `else if ...condition...`, so only advance to the next token if `then` is present
                        advance();
                    }

                    let maybeElseIfThen = block(Lexeme.EndIf, Lexeme.Else, Lexeme.ElseIf);
                    if (!maybeElseIfThen) {
                        throw addError(peek(), "Expected 'end if', 'else if', or 'else' to terminate 'then' block");
                    }

                    blockEnd = maybeElseIfThen.closingToken;
                    if (blockEnd.kind === Lexeme.EndIf) {
                        endIfToken = blockEnd;
                    }

                    elseIfBranches.push({
                        condition: elseIfCondition,
                        thenBranch: maybeElseIfThen.body,
                    });
                }

                if (blockEnd.kind === Lexeme.Else) {
                    elseToken = blockEnd;
                    let maybeElseBranch = block(Lexeme.EndIf);
                    if (!maybeElseBranch) {
                        throw addError(peek(), "Expected 'end if' to terminate 'else' block");
                    }
                    elseBranch = maybeElseBranch.body;
                    endIfToken = maybeElseBranch.closingToken;

                    //ensure that single-line `if` statements have a colon right before 'end if'
                    if (ifToken.location.start.line === endIfToken.location.start.line) {
                        let index = tokens.indexOf(endIfToken);
                        let previousToken = tokens[index - 1];
                        if (previousToken.kind !== Lexeme.Colon) {
                            addError(endIfToken, "Expected ':' to precede 'end if'");
                        }
                    }
                    match(Lexeme.Newline);
                } else {
                    if (!endIfToken) {
                        throw addError(
                            blockEnd,
                            `Expected 'end if' to close 'if' statement started on line ${startingLine.start.line}`
                        );
                    }

                    //ensure that single-line `if` statements have a colon right before 'end if'
                    if (ifToken.location.start.line === endIfToken.location.start.line) {
                        let index = tokens.indexOf(endIfToken);
                        let previousToken = tokens[index - 1];
                        if (previousToken.kind !== Lexeme.Colon) {
                            addError(endIfToken, "Expected ':' to precede 'end if'");
                        }
                    }
                    match(Lexeme.Newline);
                }
            } else {
                let maybeThenBranch = block(Lexeme.Newline, Lexeme.Eof, Lexeme.ElseIf, Lexeme.Else);
                if (!maybeThenBranch) {
                    throw addError(peek(), "Expected a statement to follow 'if ...condition... then'");
                }
                thenBranch = maybeThenBranch.body;

                let closingToken = maybeThenBranch.closingToken;
                while (closingToken.kind === Lexeme.ElseIf) {
                    let elseIf = maybeThenBranch.closingToken;
                    elseIfTokens.push(elseIf);
                    let elseIfCondition = expression();
                    if (checkThen()) {
                        // `then` is optional after `else if ...condition...`, so only advance to the next token if `then` is present
                        advance();
                    }

                    let maybeElseIfBranch = block(Lexeme.Newline, Lexeme.Eof, Lexeme.ElseIf, Lexeme.Else);
                    if (!maybeElseIfBranch) {
                        throw addError(peek(), `Expected a statement to follow '${elseIf.text} ...condition... then'`);
                    }
                    closingToken = maybeElseIfBranch.closingToken;

                    elseIfBranches.push({
                        condition: elseIfCondition,
                        thenBranch: maybeElseIfBranch.body,
                    });
                }

                if (closingToken.kind !== Lexeme.Newline && (closingToken.kind === Lexeme.Else || match(Lexeme.Else))) {
                    elseToken = closingToken;
                    let maybeElseBranch = block(Lexeme.Newline, Lexeme.Eof);
                    if (!maybeElseBranch) {
                        throw addError(peek(), `Expected a statement to follow 'else'`);
                    }
                    elseBranch = maybeElseBranch.body;
                }
            }

            return new Stmt.If(
                {
                    if: ifToken,
                    then: thenToken,
                    elseIfs: elseIfTokens,
                    endIf: endIfToken,
                    else: elseToken,
                },
                condition,
                thenBranch,
                elseIfBranches,
                elseBranch
            );
        }

        function setStatement(
            ...additionalTerminators: BlockTerminator[]
        ): Stmt.DottedSet | Stmt.IndexedSet | Stmt.Expression | Stmt.Increment {
            /**
             * Attempts to find an expression-statement or an increment statement.
             * While calls are valid expressions _and_ statements, increment (e.g. `foo++`)
             * statements aren't valid expressions. They _do_ however fall under the same parsing
             * priority as standalone function calls though, so we can parse them in the same way.
             */
            function _expressionStatement(): Stmt.Expression | Stmt.Increment {
                let expressionStart = peek();

                if (check(Lexeme.PlusPlus, Lexeme.MinusMinus)) {
                    let operator = advance();

                    if (check(Lexeme.PlusPlus, Lexeme.MinusMinus)) {
                        throw addError(peek(), "Consecutive increment/decrement operators are not allowed");
                    } else if (expr instanceof Expr.Call) {
                        throw addError(
                            expressionStart,
                            "Increment/decrement operators are not allowed on the result of a function call"
                        );
                    }

                    return new Stmt.Increment(expr, operator);
                }

                if (!check(...additionalTerminators)) {
                    consume(
                        "Expected newline or ':' after expression statement",
                        Lexeme.Newline,
                        Lexeme.Colon,
                        Lexeme.Eof
                    );
                }

                if (expr instanceof Expr.Call) {
                    return new Stmt.Expression(expr);
                }

                throw addError(expressionStart, "Expected statement or function call, but received an expression");
            }

            let expr = call();
            if (check(...assignmentOperators) && !(expr instanceof Expr.Call)) {
                let left = expr;
                let operator = advance();
                let right = expression();

                // Create a dotted or indexed "set" based on the left-hand side's type
                if (left instanceof Expr.IndexedGet) {
                    consume(
                        "Expected newline or ':' after indexed 'set' statement",
                        Lexeme.Newline,
                        Lexeme.Else,
                        Lexeme.ElseIf,
                        Lexeme.Colon,
                        Lexeme.Eof
                    );

                    return new Stmt.IndexedSet(
                        left.obj,
                        left.indexes,
                        operator.kind === Lexeme.Equal ? right : new Expr.Binary(left, operator, right),
                        left.closingSquare
                    );
                } else if (left instanceof Expr.DottedGet) {
                    consume(
                        "Expected newline or ':' after dotted 'set' statement",
                        Lexeme.Newline,
                        Lexeme.Else,
                        Lexeme.ElseIf,
                        Lexeme.Colon,
                        Lexeme.Eof
                    );

                    return new Stmt.DottedSet(
                        left.obj,
                        left.name,
                        operator.kind === Lexeme.Equal ? right : new Expr.Binary(left, operator, right)
                    );
                } else {
                    return _expressionStatement();
                }
            } else {
                return _expressionStatement();
            }
        }

        function printStatement(...additionalTerminators: BlockTerminator[]): Stmt.Print {
            let printKeyword = advance();

            let values: (Expr.Expression | Stmt.PrintSeparator.Tab | Stmt.PrintSeparator.Space)[] = [];

            //print statements can be empty, so look for empty print conditions
            if (isAtEnd() || check(Lexeme.Newline, Lexeme.Colon)) {
                let emptyStringLiteral = new Expr.Literal(new BrsString(""), printKeyword.location);
                values.push(emptyStringLiteral);
            } else {
                values.push(expression());
            }

            while (!check(Lexeme.Newline, Lexeme.Colon, ...additionalTerminators) && !isAtEnd()) {
                if (check(Lexeme.Semicolon)) {
                    values.push(advance() as Stmt.PrintSeparator.Space);
                }

                if (check(Lexeme.Comma)) {
                    values.push(advance() as Stmt.PrintSeparator.Tab);
                }

                if (!check(Lexeme.Newline, Lexeme.Colon) && !isAtEnd()) {
                    values.push(expression());
                }
            }

            if (!check(...additionalTerminators)) {
                consume("Expected newline or ':' after printed values", Lexeme.Newline, Lexeme.Colon, Lexeme.Eof);
            }

            return new Stmt.Print({ print: printKeyword }, values);
        }

        /**
         * Parses a return statement with an optional return value.
         * @returns an AST representation of a return statement.
         */
        function returnStatement(): Stmt.Return {
            let tokens = { return: previous() };

            if (check(Lexeme.Colon, Lexeme.Newline, Lexeme.Eof)) {
                while (match(Lexeme.Colon, Lexeme.Newline, Lexeme.Eof));
                return new Stmt.Return(tokens);
            }

            let toReturn = expression();
            while (match(Lexeme.Newline, Lexeme.Colon));

            return new Stmt.Return(tokens, toReturn);
        }

        /**
         * Parses a `throw` statement with an error value.
         * @returns an AST representation of a throw statement.
         */
        function throwStatement(): Stmt.Throw {
            let tokens = { throw: previous() };

            let toThrow = expression();
            while (match(Lexeme.Newline, Lexeme.Colon));

            return new Stmt.Throw(tokens, toThrow);
        }

        /**
         * Parses a `label` statement
         * @returns an AST representation of an `label` statement.
         */
        function labelStatement() {
            let tokens = {
                identifier: advance(),
                colon: advance(),
            };

            consume("Labels must be declared on their own line", Lexeme.Newline, Lexeme.Eof);

            return new Stmt.Label(tokens);
        }

        /**
         * Parses a `dim` statement
         * @returns an AST representation of an `dim` statement.
         */
        function dimStatement() {
            let dimToken = advance();

            let name = consume("Expected variable name after 'dim'", Lexeme.Identifier);

            match(Lexeme.LeftSquare);

            let dimensions: Expression[] = [expression()];
            while (!match(Lexeme.RightSquare)) {
                consume("Expected ',' after expression in 'dim' statement", Lexeme.Comma);
                dimensions.push(expression());
            }
            let rightSquare = previous();

            let tokens = {
                dim: dimToken,
                closingBrace: rightSquare,
            };

            return new Stmt.Dim(tokens, name as Identifier, dimensions);
        }

        /**
         * Parses a `goto` statement
         * @returns an AST representation of an `goto` statement.
         */
        function gotoStatement() {
            let tokens = {
                goto: advance(),
                label: consume("Expected valid label after goto keyword", Lexeme.Identifier, Lexeme.Integer),
            };

            while (match(Lexeme.Newline, Lexeme.Colon));

            return new Stmt.Goto(tokens);
        }

        /**
         * Parses an `end` statement
         * @returns an AST representation of an `end` statement.
         */
        function endStatement() {
            let tokens = { end: advance() };

            while (match(Lexeme.Newline, Lexeme.Colon));

            return new Stmt.End(tokens);
        }
        /**
         * Parses a `stop` statement
         * @returns an AST representation of a `stop` statement
         */
        function stopStatement() {
            let tokens = { stop: advance() };

            while (match(Lexeme.Newline, Lexeme.Colon));

            return new Stmt.Stop(tokens);
        }

        /**
         * Parses a block, looking for a specific terminating Lexeme to denote completion.
         * @param terminators the token(s) that signifies the end of this block; all other terminators are
         *                    ignored.
         */
        function block(...terminators: BlockTerminator[]): { body: Stmt.Block; closingToken: Token } | undefined {
            let startingToken = peek();

            let statementSeparators = [Lexeme.Colon];
            if (!terminators.includes(Lexeme.Newline)) {
                statementSeparators.push(Lexeme.Newline);
            }

            while (match(...statementSeparators));

            let closingToken: Token | undefined;
            const statements: Statement[] = [];
            while (!check(...terminators) && !isAtEnd()) {
                //grab the location of the current token
                let loopCurrent = current;
                let dec = declaration(...terminators);

                if (dec) {
                    if (dec instanceof Stmt.Label && parsingTryBlock) {
                        addErrorAtLocation(dec.location, RuntimeErrorDetail.TryContainsLabel.message);
                    } else {
                        statements.push(dec);
                    }
                } else {
                    //something went wrong. reset to the top of the loop
                    current = loopCurrent;

                    //scrap the entire line
                    consumeUntil(Lexeme.Colon, Lexeme.Newline, Lexeme.Eof);
                    //trash the newline character so we start the next iteration on the next line
                    advance();
                }

                if (checkPrevious(...terminators)) {
                    closingToken = previous();
                    while (match(...statementSeparators));
                    break;
                } else {
                    while (match(...statementSeparators));
                }
            }

            if (isAtEnd() && !terminators.includes(Lexeme.Eof)) {
                return undefined;
                // TODO: Figure out how to handle unterminated blocks well
            }

            // consume the last terminator
            if (check(...terminators) && !closingToken) {
                closingToken = advance();
                const nextToken = peek();
                if (closingToken.kind === "Next" && nextToken.kind === "Identifier") {
                    advance();
                }
            }

            if (!closingToken) {
                return undefined;
            }

            //the block's location starts at the end of the preceding token, and stops at the beginning of the `end` token
            const location: Location = {
                file: startingToken.location.file,
                start: startingToken.location.start,
                end: closingToken.location.start,
            };

            return {
                body: new Stmt.Block(statements, location),
                closingToken,
            };
        }

        function expression(): Expression {
            return anonymousFunction();
        }

        function anonymousFunction(): Expression {
            if (check(Lexeme.Sub, Lexeme.Function)) {
                return functionDeclaration(true);
            }

            return boolean();
        }

        function boolean(): Expression {
            let expr = relational();

            while (match(Lexeme.And, Lexeme.Or)) {
                let operator = previous();
                let right = relational();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function relational(): Expression {
            let expr = bitshift();

            while (
                match(
                    Lexeme.Equal,
                    Lexeme.LessGreater,
                    Lexeme.Greater,
                    Lexeme.GreaterEqual,
                    Lexeme.Less,
                    Lexeme.LessEqual
                )
            ) {
                let operator = previous();
                let right = bitshift();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function bitshift(): Expression {
            let expr = additive();

            while (match(Lexeme.LeftShift, Lexeme.RightShift)) {
                let operator = previous();
                let right = additive();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function additive(): Expression {
            let expr = multiplicative();

            while (match(Lexeme.Plus, Lexeme.Minus)) {
                let operator = previous();
                let right = multiplicative();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function multiplicative(): Expression {
            let expr = exponential();

            while (match(Lexeme.Slash, Lexeme.Backslash, Lexeme.Star, Lexeme.Mod)) {
                let operator = previous();
                let right = exponential();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function exponential(): Expression {
            let expr = prefixUnary();

            while (match(Lexeme.Caret)) {
                let operator = previous();
                let right = prefixUnary();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function prefixUnary(): Expression {
            if (match(Lexeme.Not)) {
                let operator = previous();
                let right = relational();
                return new Expr.Unary(operator, right);
            } else if (match(Lexeme.Minus, Lexeme.Plus)) {
                let operator = previous();
                let right = prefixUnary();
                return new Expr.Unary(operator, right);
            }

            return call();
        }

        function call(): Expression {
            let expr = primary();

            function indexedGet() {
                const optional = previous().text === "?[";
                let elements: Expression[] = [];

                while (match(Lexeme.Newline));

                if (!match(Lexeme.RightSquare)) {
                    elements.push(expression());

                    while (match(Lexeme.Comma, Lexeme.Newline)) {
                        while (match(Lexeme.Newline));

                        if (check(Lexeme.RightSquare)) {
                            break;
                        }

                        elements.push(expression());
                    }
                }
                if (elements.length === 0) {
                    throw addError(peek(), "Expected expression inside brackets []");
                }
                let closingSquare = consume("Expected ']' after array or object index", Lexeme.RightSquare);

                expr = new Expr.IndexedGet(expr, elements, closingSquare, optional);
            }

            while (true) {
                if (match(Lexeme.LeftParen)) {
                    expr = finishCall(expr);
                } else if (match(Lexeme.LeftSquare)) {
                    indexedGet();
                } else if (match(Lexeme.AtSymbol)) {
                    const optional = previous().text === "?@";
                    while (match(Lexeme.Newline));
                    let name = consume("Expected identifier name after '@'", Lexeme.Identifier, ...allowedProperties);
                    // force it into an identifier so the AST makes some sense
                    name.kind = Lexeme.Identifier;
                    expr = new Expr.AtSignGet(expr, name as Identifier, optional);
                } else if (match(Lexeme.Dot)) {
                    if (match(Lexeme.LeftSquare)) {
                        indexedGet();
                    } else {
                        const optional = previous().text === "?.";
                        while (match(Lexeme.Newline));

                        let name = consume("Expected property name after '.'", Lexeme.Identifier, ...allowedProperties);

                        // force it into an identifier so the AST makes some sense
                        name.kind = Lexeme.Identifier;
                        countIdentifier(name.text);
                        expr = new Expr.DottedGet(expr, name as Identifier, optional);
                    }
                } else {
                    break;
                }
            }

            return expr;
        }

        function finishCall(callee: Expression): Expression {
            const optional = previous().text === "?(";
            let args = [];
            while (match(Lexeme.Newline));

            if (!check(Lexeme.RightParen)) {
                do {
                    while (match(Lexeme.Newline));

                    if (args.length >= Expr.Call.MaximumArguments) {
                        throw addError(peek(), `Cannot have more than ${Expr.Call.MaximumArguments} arguments`);
                    }
                    args.push(expression());
                } while (match(Lexeme.Comma));
            }

            while (match(Lexeme.Newline));
            const closingParen = consume("Expected ')' after function call arguments", Lexeme.RightParen);

            if (callee instanceof Expr.Variable && callee.name.text.toLowerCase() === "createobject") {
                // RBI doesn't count the object name, but only if a single argument is passed
                if (args.length === 1 && args[0] instanceof Expr.Literal) {
                    const name = args[0].value.toString();
                    const strings = self.stats.get(Lexeme.String);
                    if (strings && strings.has(name) && Array.from(strings).pop() === name) {
                        strings.delete(name);
                    }
                }
            }
            return new Expr.Call(callee, closingParen, args, optional);
        }

        function primary(): Expression {
            switch (true) {
                case match(Lexeme.False):
                    return new Expr.Literal(BrsBoolean.False, previous().location);
                case match(Lexeme.True):
                    return new Expr.Literal(BrsBoolean.True, previous().location);
                case match(Lexeme.Invalid):
                    return new Expr.Literal(BrsInvalid.Instance, previous().location);
                case match(Lexeme.Integer, Lexeme.LongInteger, Lexeme.Float, Lexeme.Double, Lexeme.String):
                    countLiteral(Lexeme[previous().kind], previous().literal);
                    return new Expr.Literal(previous().literal!, previous().location);
                case match(Lexeme.Identifier):
                    return new Expr.Variable(previous() as Identifier);
                case match(Lexeme.LeftParen): {
                    let left = previous();
                    let expr = expression();
                    let right = consume("Unmatched '(' - expected ')' after expression", Lexeme.RightParen);
                    return new Expr.Grouping({ left, right }, expr);
                }
                case match(Lexeme.LeftSquare): {
                    let elements: Expression[] = [];
                    let openingSquare = previous();

                    while (match(Lexeme.Newline));

                    if (!match(Lexeme.RightSquare)) {
                        elements.push(expression());

                        while (match(Lexeme.Comma, Lexeme.Newline)) {
                            while (match(Lexeme.Newline));

                            if (check(Lexeme.RightSquare)) {
                                break;
                            }

                            elements.push(expression());
                        }

                        consume("Unmatched '[' - expected ']' after array literal", Lexeme.RightSquare);
                    }

                    let closingSquare = previous();

                    // When we initialize a literal array the capacity and object name are counted
                    countLiteral(Lexeme.Integer, new Int32(10));
                    countLiteral(Lexeme.String, new BrsString("roArray"));
                    if (elements.length) {
                        countIdentifier("");
                    }
                    return new Expr.ArrayLiteral(elements, openingSquare, closingSquare);
                }
                case match(Lexeme.LeftBrace): {
                    let openingBrace = previous();
                    let members: Expr.AAMember[] = [];

                    function key() {
                        let k;
                        if (check(Lexeme.Identifier, ...allowedProperties)) {
                            k = new BrsString(advance().text!);
                        } else if (check(Lexeme.String)) {
                            k = advance().literal! as BrsString;
                        } else {
                            throw addError(
                                peek(),
                                `Expected identifier or string as associative array key, but received '${
                                    peek().text || ""
                                }'`
                            );
                        }

                        consume("Expected ':' between associative array key and value", Lexeme.Colon);
                        return k;
                    }

                    while (match(Lexeme.Newline));

                    if (!match(Lexeme.RightBrace)) {
                        members.push({
                            name: key(),
                            value: expression(),
                        });

                        while (match(Lexeme.Comma, Lexeme.Newline, Lexeme.Colon)) {
                            while (match(Lexeme.Newline, Lexeme.Colon));

                            if (check(Lexeme.RightBrace)) {
                                break;
                            }

                            members.push({
                                name: key(),
                                value: expression(),
                            });
                        }

                        consume("Unmatched '{' - expected '}' after associative array literal", Lexeme.RightBrace);
                        if (members.length) {
                            countIdentifier("");
                            members.forEach((member) => {
                                countIdentifier(member.name.value);
                            });
                        }
                    }

                    let closingBrace = previous();

                    return new Expr.AALiteral(members, openingBrace, closingBrace);
                }
                case match(Lexeme.Pos, Lexeme.Tab): {
                    let token = Object.assign(previous(), {
                        kind: Lexeme.Identifier,
                    }) as Identifier;
                    return new Expr.Variable(token);
                }
                case check(Lexeme.Function, Lexeme.Sub):
                    return anonymousFunction();
                default:
                    throw addError(peek(), `Found unexpected token '${peek().text}'`);
            }
        }

        function match(...lexemes: Lexeme[]) {
            for (let lexeme of lexemes) {
                if (check(lexeme)) {
                    advance();
                    return true;
                }
            }

            return false;
        }

        /**
         * Consume tokens until one of the `stopLexemes` is encountered
         * @param lexemes
         * @return - the list of tokens consumed, EXCLUDING the `stopLexeme` (you can use `peek()` to see which one it was)
         */
        function consumeUntil(...stopLexemes: Lexeme[]) {
            let result = [] as Token[];
            //take tokens until we encounter one of the stopLexemes
            while (!stopLexemes.includes(peek().kind)) {
                result.push(advance());
            }
            return result;
        }

        /**
         * Checks that the next token is one of a list of lexemes and returns that token, and *advances past it*.
         * If the next token is none of the provided lexemes, throws an error.
         * @param message - the message to include in the thrown error if the next token isn't one of the provided `lexemes`
         * @param lexemes - the set of `lexemes` to check for
         *
         * @see checkOrError
         */
        function consume(message: string, ...lexemes: Lexeme[]): Token {
            let foundLexeme = lexemes
                .map((lexeme) => peek().kind === lexeme)
                .reduce((foundAny, foundCurrent) => foundAny || foundCurrent, false);

            if (foundLexeme) {
                return advance();
            }
            throw addError(peek(), message);
        }

        function advance(): Token {
            if (!isAtEnd()) {
                current++;
            }
            return previous();
        }

        /**
         * Checks that the next token is one of a list of lexemes and returns that token, but *does not advance past it*.
         * If the next token is none of the provided lexemes, throws an error.
         * @param message - the message to include in the thrown error if the next token isn't one of the provided `lexemes`
         * @param lexemes - the set of `lexemes` to check for
         *
         * @see consume
         */
        function checkOrThrow(message: string, ...lexemes: Lexeme[]): Token {
            let foundLexeme = lexemes
                .map((lexeme) => peek().kind === lexeme)
                .reduce((foundAny, foundCurrent) => foundAny || foundCurrent, false);
            if (foundLexeme) {
                return peek();
            }

            throw addError(peek(), message);
        }

        /**
         * Check that the previous token matches one of the specified Lexemes
         * @param lexemes
         */
        function checkPrevious(...lexemes: Lexeme[]) {
            if (current === 0) {
                return false;
            } else {
                current--;
                const result = check(...lexemes);
                current++;
                return result;
            }
        }

        function check(...lexemes: Lexeme[]) {
            if (isAtEnd()) {
                return false;
            }

            return lexemes.some((lexeme) => peek().kind === lexeme);
        }

        function checkNext(...lexemes: Lexeme[]) {
            if (isAtEnd()) {
                return false;
            }

            return lexemes.some((lexeme) => peekNext().kind === lexeme);
        }

        function isAtEnd() {
            return peek().kind === Lexeme.Eof;
        }

        function peekNext() {
            if (isAtEnd()) {
                return peek();
            }
            return tokens[current + 1];
        }

        function peek() {
            return tokens[current];
        }

        function previous() {
            return tokens[current - 1];
        }

        function synchronize() {
            advance(); // skip the erroneous token

            while (!isAtEnd()) {
                if (previous().kind === Lexeme.Newline || previous().kind === Lexeme.Colon) {
                    // newlines and ':' characters separate statements
                    return;
                }

                switch (peek().kind) {
                    case Lexeme.Function:
                    case Lexeme.Sub:
                    case Lexeme.If:
                    case Lexeme.For:
                    case Lexeme.ForEach:
                    case Lexeme.While:
                    case Lexeme.Print:
                    case Lexeme.Return:
                        // start parsing again from the next block starter or obvious
                        // expression start
                        return;
                }

                advance();
            }
        }

        function countFunction(name: string) {
            const funcs = self.stats.get(Lexeme.Function);
            if (funcs) {
                funcs.add(`${name.toLowerCase()}(${funcs.size})`);
            }
        }

        function countLiteral(lexeme: Lexeme, value?: BrsType) {
            const literals = self.stats.get(lexeme);
            if (literals && value && !literals.has(value.toString())) {
                literals.add(value.toString());
            }
        }

        function countIdentifier(name: string) {
            const identifiers = self.stats.get(Lexeme.Identifier);
            if (identifiers && !identifiers?.has(name.toLowerCase())) {
                identifiers.add(name.toLowerCase());
            }
        }
    }
}
