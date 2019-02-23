import { EventEmitter } from "events";

import * as Expr from "./Expression";
type Expression = Expr.Expression;
import * as Stmt from "./Statement";
type Statement = Stmt.Statement;
import { Lexeme, Token, Identifier, ReservedWords } from "../lexer";
import { ParseError } from "./ParseError";

import {
    BrsInvalid,
    BrsBoolean,
    BrsString,
    Int32,
    ValueKind,
    Argument,
    StdlibArgument
} from "../brsTypes";

/** Set of all keywords that end blocks. */
type BlockTerminator =
    Lexeme.ElseIf |
    Lexeme.Else |
    Lexeme.EndFor |
    Lexeme.Next |
    Lexeme.EndIf |
    Lexeme.EndWhile |
    Lexeme.EndSub |
    Lexeme.EndFunction;

/** The set of operators valid for use in assignment statements. */
const assignmentOperators = [
    Lexeme.Equal,
    Lexeme.CaretEqual,
    Lexeme.MinusEqual,
    Lexeme.PlusEqual,
    Lexeme.StarEqual,
    Lexeme.SlashEqual,
    Lexeme.BackslashEqual,
    Lexeme.LeftShiftEqual,
    Lexeme.RightShiftEqual
];

/** The results of a Parser's parsing pass. */
interface ParseResults {
    /** The statements produced by the parser. */
    statements: Stmt.Statement[],
    /** The errors encountered by the Parser. */
    errors: ParseError[]
}

export class Parser {
    /** Allows consumers to observe errors as they're detected. */
    readonly events = new EventEmitter();

    /**
     * A convenience function, equivalent to `new Parser().parse(toParse)`, that parses an array of
     * `Token`s into an abstract syntax tree that can be executed with the `Interpreter`.
     * @param toParse the array of tokens to parse
     * @returns an array of `Statement` objects that together form the abstract syntax tree of the
     *          program
     */
    static parse(toParse: ReadonlyArray<Token>) {
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
            }
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
    parse(toParse: ReadonlyArray<Token>): ParseResults {
        let current = 0;
        let tokens = toParse;

        let statements: Statement[] = [];

        let errors: ParseError[] = [];

        const addError = (err: ParseError) => {
            errors.push(err);
            this.events.emit("err", err);
            throw err;
        };


        if (toParse.length === 0) {
            return {
                statements: [],
                errors: []
            };
        }

        try {
            while (!isAtEnd()) {
                let dec = declaration();
                if (dec) {
                    statements.push(dec);
                }
            }

            return { statements, errors };
        } catch (parseError) {
            return {
                statements: [],
                errors: errors
            };
        }

        function declaration(...additionalTerminators: BlockTerminator[]): Statement | undefined {
            try {
                // consume any leading newlines
                while(match(Lexeme.Newline));

                if (check(Lexeme.Sub, Lexeme.Function)) {
                    return functionDeclaration(false);
                }

                // BrightScript is like python, in that variables can be declared without a `var`,
                // `let`, (...) keyword. As such, we must check the token *after* an identifier to figure
                // out what to do with it.
                if ( check(Lexeme.Identifier) && checkNext(...assignmentOperators)) {
                    return assignment(...additionalTerminators);
                }

                return statement(...additionalTerminators);
            } catch (error) {
                synchronize();
                return;
            }
        }

        function functionDeclaration(isAnonymous: true): Expr.Function;
        function functionDeclaration(isAnonymous: false): Stmt.Function;
        function functionDeclaration(isAnonymous: boolean) {
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

            if (isAnonymous) {
                leftParen = consume(`Expected '(' after ${functionType.text}`, Lexeme.LeftParen);
            } else {
                name = consume(`Expected ${functionType.text} name after '${functionType.text}'`, Lexeme.Identifier) as Identifier;
                leftParen = consume(`Expected '(' after ${functionType.text} name`, Lexeme.LeftParen);
            }

            let args: Argument[] = [];
            if (!check(Lexeme.RightParen)) {
                do {
                    if (args.length >= Expr.Call.MaximumArguments) {
                        addError(
                            new ParseError(peek(), `Cannot have more than ${Expr.Call.MaximumArguments} arguments`)
                        );
                        break;
                    }

                    args.push(signatureArgument());
                } while (match(Lexeme.Comma));
            }
            rightParen = advance();

            let maybeAs = peek();
            if (check(Lexeme.Identifier) && maybeAs.text && maybeAs.text.toLowerCase() === "as") {
                advance();
                if (isSub) {
                    return addError(
                        new ParseError(previous(), "'Sub' functions are always void returns, and can't have 'as' clauses")
                    );
                }

                let typeToken = advance();
                let typeString = typeToken.text || "";
                let maybeReturnType = ValueKind.fromString(typeString);

                if (!maybeReturnType) {
                    return addError(
                        new ParseError(typeToken, `Function return type '${typeString}' is invalid`)
                    );
                }

                returnType = maybeReturnType;
            }

            args.reduce((haveFoundOptional: boolean, arg: Argument) => {
                if (haveFoundOptional && !arg.defaultValue) {
                    return addError(
                        new ParseError(
                            { kind: Lexeme.Identifier, text: arg.name.text, isReserved: ReservedWords.has(arg.name.text), location: arg.location },
                            `Argument '${arg.name}' has no default value, but comes after arguments with default values`
                        )
                    );
                }

                return haveFoundOptional || !!arg.defaultValue;
            }, false);

            consume(`Expected newline or ':' after ${functionType.text} signature`, Lexeme.Newline, Lexeme.Colon);
            let body = block(isSub ? Lexeme.EndSub : Lexeme.EndFunction);
            if (!body) {
                return addError(
                    new ParseError(peek(), `Expected 'end ${functionType.text}' to terminate ${functionType.text} block`)
                );
            }
            // consume 'end sub' or 'end function'
            let endingKeyword = advance();


            let func = new Expr.Function(args, returnType, body, startingKeyword, endingKeyword);

            if (isAnonymous) {
                return func;
            } else {
                // only consume trailing newlines in the statement context; expressions
                // expect to handle their own trailing whitespace
                while(match(Lexeme.Newline));
                return new Stmt.Function(name!, func);
            }
        }

        function signatureArgument(): Argument {
            if (!check(Lexeme.Identifier)) {
                return addError(
                    new ParseError(peek(), `Expected argument name, but received '${peek().text || ""}'`)
                );
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
                    return addError(
                        new ParseError(typeToken, `Function parameter '${name.text}' is of invalid type '${typeToken.text}'`)
                    );
                }

                type = typeValueKind;
            }

            return {
                name: name,
                type: {
                    kind: type,
                    location: typeToken ? typeToken.location : StdlibArgument.InternalLocation
                },
                defaultValue: defaultValue,
                location: {
                    file: name.location.file,
                    start: name.location.start,
                    end: typeToken ? typeToken.location.end : name.location.end
                }
            };
        }

        function assignment(...additionalterminators: Lexeme[]): Stmt.Assignment {
            let name = advance() as Identifier;
            let operator = consume(
                `Expected operator ('=', '+=', '-=', '*=', '/=', '\\=', '^=', '<<=', or '>>=') after idenfifier '${name.text}'`,
                ...assignmentOperators
            );

            let value = expression();
            if (!check(...additionalterminators)) {
                consume("Expected newline or ':' after assignment", Lexeme.Newline, Lexeme.Colon, Lexeme.Eof, ...additionalterminators);
            }

            if (operator.kind === Lexeme.Equal) {
                return new Stmt.Assignment(
                    { equals: operator },
                    name,
                    value
                );
            } else {
                return new Stmt.Assignment(
                    { equals: operator },
                    name,
                    new Expr.Binary(new Expr.Variable(name), operator, value)
                );
            }
        }

        function statement(...additionalterminators: BlockTerminator[]): Statement {
            if (check(Lexeme.If)) { return ifStatement(); }

            if (check(Lexeme.Print)) { return printStatement(...additionalterminators); }

            if (check(Lexeme.While)) { return whileStatement(); }

            if (check(Lexeme.ExitWhile)) { return exitWhile(); }

            if (check(Lexeme.For)) { return forStatement(); }

            if (check(Lexeme.ForEach)) { return forEachStatement(); }

            if (check(Lexeme.ExitFor)) { return exitFor(); }

            if (match(Lexeme.Return)) { return returnStatement(); }

            // TODO: support multi-statements
            return expressionStatement(...additionalterminators);
        }

        function whileStatement(): Stmt.While {
            const whileKeyword = advance();
            const condition = expression();

            consume("Expected newline after 'while ...condition...'", Lexeme.Newline);
            const whileBlock = block(Lexeme.EndWhile);
            if (!whileBlock) {
                return addError(
                    new ParseError(peek(), "Expected 'end while' to terminate while-loop block")
                );
            }
            const endWhile = advance();
            while (match(Lexeme.Newline));

            return new Stmt.While(
                { while: whileKeyword, endWhile: endWhile },
                condition,
                whileBlock
            );
        }

        function exitWhile(): Stmt.ExitWhile {
            let keyword = advance();
            consume("Expected newline after 'exit while'", Lexeme.Newline);
            while (match(Lexeme.Newline)) {}
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
            while(match(Lexeme.Newline));

            let body = block(Lexeme.EndFor, Lexeme.Next);
            if (!body) {
                return addError(
                    new ParseError(peek(), "Expected 'end for' or 'next' to terminate for-loop block")
                );
            }
            let endFor = advance();
            while(match(Lexeme.Newline));

            // WARNING: BrightScript doesn't delete the loop initial value after a for/to loop! It just
            // stays around in scope with whatever value it was when the loop exited.
            return new Stmt.For(
                {
                    for: forKeyword,
                    to: to,
                    step: step,
                    endFor: endFor
                },
                initializer,
                finalValue,
                increment,
                body
            );
        }

        function forEachStatement(): Stmt.ForEach {
            let forEach = advance();
            let name = advance();

            let maybeIn = peek();
            if (check(Lexeme.Identifier) && maybeIn.text && maybeIn.text.toLowerCase() === "in") {
                advance();
            } else {
                return addError(
                    new ParseError(maybeIn, "Expected 'in' after 'for each <name>'")
                );
            }

            let target = expression();
            if (!target) {
                return addError(
                    new ParseError(peek(), "Expected target object to iterate over")
                );
            }
            advance();
            while(match(Lexeme.Newline));

            let body = block(Lexeme.EndFor, Lexeme.Next);
            if (!body) {
                return addError(
                    new ParseError(peek(), "Expected 'end for' or 'next' to terminate for-loop block")
                );
            }
            let endFor = advance();
            while(match(Lexeme.Newline));

            return new Stmt.ForEach(
                {
                    forEach: forEach,
                    in: maybeIn,
                    endFor: endFor
                },
                name,
                target,
                body
            );
        }

        function exitFor(): Stmt.ExitFor {
            let keyword = advance();
            consume("Expected newline after 'exit for'", Lexeme.Newline);
            while (match(Lexeme.Newline)) {}
            return new Stmt.ExitFor({ exitFor: keyword });
        }

        function ifStatement(): Stmt.If {
            const ifToken = advance();
            const startingLine = ifToken.location;

            const condition = expression();
            let thenBranch: Stmt.Block;
            let elseIfBranches: Stmt.ElseIf[] = [];
            let elseBranch: Stmt.Block | undefined;

            let then: Token | undefined;
            let elseIfTokens: Token[] = [];
            let endIf: Token | undefined;

            if (check(Lexeme.Then)) {
                // `then` is optional after `if ...condition...`, so only advance to the next token if `then` is present
                then = advance();
            }

            if (match(Lexeme.Newline)) {
                // we're parsing a multi-line ("block") form of the BrightScript if/then/else and must find
                // a trailing "end if"

                let maybeThenBranch = block(Lexeme.EndIf, Lexeme.Else, Lexeme.ElseIf);
                if (!maybeThenBranch) {
                    return addError(
                        new ParseError(peek(), "Expected 'end if', 'else if', or 'else' to terminate 'then' block")
                    );
                }

                let blockEnd = previous();
                if (blockEnd.kind === Lexeme.EndIf) {
                    endIf = blockEnd;
                }

                thenBranch = maybeThenBranch;
                match(Lexeme.Newline);

                // attempt to read a bunch of "else if" clauses
                while (check(Lexeme.ElseIf)) {
                    elseIfTokens.push(advance());
                    let elseIfCondition = expression();
                    if (check(Lexeme.Then)) {
                        // `then` is optional after `else if ...condition...`, so only advance to the next token if `then` is present
                        advance();
                    }
                    match(Lexeme.Newline);
                    let elseIfThen = block(Lexeme.EndIf, Lexeme.Else, Lexeme.ElseIf);
                    if (!elseIfThen) {
                        return addError(
                            new ParseError(peek(), "Expected 'end if', 'else if', or 'else' to terminate 'then' block")
                        );
                    }

                    let blockEnd = previous();
                    if (blockEnd.kind === Lexeme.EndIf) {
                        endIf = blockEnd;
                    }

                    elseIfBranches.push({
                        condition: elseIfCondition,
                        thenBranch: elseIfThen
                    });
                }

                if (match(Lexeme.Else)) {
                    match(Lexeme.Newline);
                    elseBranch = block(Lexeme.EndIf);
                    advance(); // skip past "end if"
                    match(Lexeme.Newline);
                } else {
                    match(Lexeme.Newline);
                    endIf = consume(
                        `Expected 'end if' to close 'if' statement started on line ${startingLine}`,
                        Lexeme.EndIf
                    );
                    match(Lexeme.Newline);
                }
            } else {
                let thenStatement = declaration(Lexeme.ElseIf, Lexeme.Else);
                if (!thenStatement) {
                    return addError(
                        new ParseError(peek(), "Expected a statement to follow 'if ...condition... then'")
                    );
                }
                thenBranch = new Stmt.Block([thenStatement], peek().location);

                while(match(Lexeme.ElseIf)) {
                    let elseIf = previous();
                    let elseIfCondition = expression();
                    if (check(Lexeme.Then)) {
                        // `then` is optional after `else if ...condition...`, so only advance to the next token if `then` is present
                        advance();
                    }

                    let elseIfThen = declaration(Lexeme.ElseIf, Lexeme.Else);
                    if (!elseIfThen) {
                        return addError(
                            new ParseError(
                                peek(),
                                `Expected a statement to follow '${elseIf.text} ...condition... then'`
                            )
                        );
                    }

                    elseIfBranches.push({
                        condition: elseIfCondition,
                        thenBranch: new Stmt.Block([elseIfThen], peek().location)
                    });
                }

                if (match(Lexeme.Else)) {
                    let elseStatement = declaration();
                    if (!elseStatement) {
                        return addError(
                            new ParseError(peek(), `Expected a statement to follow 'else'`)
                        );
                    }
                    elseBranch = new Stmt.Block([elseStatement], peek().location);
                }
            }

            return new Stmt.If(
                {
                    if: ifToken,
                    then: then,
                    elseIfs: elseIfTokens,
                    endIf: endIf
                },
                condition,
                thenBranch,
                elseIfBranches,
                elseBranch
            );
        }

        function expressionStatement(...additionalterminators: BlockTerminator[]): Stmt.Expression | Stmt.DottedSet | Stmt.IndexedSet {
            let expressionStart = peek();
            let expr = expression();

            if (!check(...additionalterminators)) {
                consume("Expected newline or ':' after expression statement", Lexeme.Newline, Lexeme.Colon, Lexeme.Eof);
            }

            if (expr instanceof Expr.Call) {
                return new Stmt.Expression(expr);
            } else if (expr instanceof Expr.Binary) {
                if (expr.left instanceof Expr.IndexedGet && expr.token.kind === Lexeme.Equal) {
                    return new Stmt.IndexedSet(
                        expr.left.obj,
                        expr.left.index,
                        expr.right,
                        expr.left.closingSquare
                    );
                } else if (expr.left instanceof Expr.DottedGet && expr.token.kind === Lexeme.Equal) {
                    return new Stmt.DottedSet(
                        expr.left.obj,
                        expr.left.name,
                        expr.right
                    );
                }
            }

            return addError(
                new ParseError(expressionStart, "Expected statement or function call, but received an expression")
            );
        }

        function printStatement(...additionalterminators: BlockTerminator[]): Stmt.Print {
            let printKeyword = advance();

            let values: (Expr.Expression | Stmt.PrintSeparator.Tab | Stmt.PrintSeparator.Space)[] = [];
            values.push(expression());

            while (!check(Lexeme.Newline, Lexeme.Colon, ...additionalterminators) && !isAtEnd()) {
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

            if (!check(...additionalterminators)) {
                consume("Expected newline or ':' after printed values", Lexeme.Newline, Lexeme.Colon, Lexeme.Eof);
            }

            return new Stmt.Print({ print: printKeyword }, values);
        }

        /**
         * Parses a return statement with an optional return value.
         * @returns an AST representation of a return statement.
         */
        function returnStatement(): Stmt.Return {
            let tokens = { return: previous()};

            if (check(Lexeme.Colon, Lexeme.Newline, Lexeme.Eof)) {
                while(match(Lexeme.Colon, Lexeme.Newline, Lexeme.Eof));
                return new Stmt.Return(tokens);
            }

            let toReturn = expression();
            while(match(Lexeme.Newline));

            return new Stmt.Return(tokens, toReturn);
        }

        /**
         * Parses a block, looking for a specific terminating Lexeme to denote completion.
         * @param terminators the token(s) that signifies the end of this block; all other terminators are
         *                    ignored.
         */
        function block(...terminators: BlockTerminator[]): Stmt.Block | undefined {
            let startingToken = peek();

            const statements: Statement[] = [];
            while (!check(...terminators) && !isAtEnd()) {
                const dec = declaration();
                if (dec) {
                    statements.push(dec);
                }
            }

            if (isAtEnd()) {
                return undefined;
                // TODO: Figure out how to handle unterminated blocks well
            }

            return new Stmt.Block(statements, startingToken.location);
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
            let expr = additive();

            while (match(
                Lexeme.Equal,
                Lexeme.LessGreater,
                Lexeme.Greater,
                Lexeme.GreaterEqual,
                Lexeme.Less,
                Lexeme.LessEqual
            )) {
                let operator = previous();
                let right = additive();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        // TODO: bitshift

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
            let expr = unary();

            while (match(Lexeme.Caret)) {
                let operator = previous();
                let right = unary();
                expr = new Expr.Binary(expr, operator, right);
            }

            return expr;
        }

        function unary(): Expression {
            if (match(Lexeme.Not, Lexeme.Minus)) {
                let operator = previous();
                let right = unary();
                return new Expr.Unary(operator, right);
            }

            return call();
        }

        function call(): Expression {
            let expr = primary();

            while (true) {
                if (match(Lexeme.LeftParen)) {
                    expr = finishCall(expr);
                } else if (match(Lexeme.LeftSquare)) {
                    while (match(Lexeme.Newline));

                    let index = expression();

                    while (match(Lexeme.Newline));
                    let closingSquare = consume("Expected ']' after array or object index", Lexeme.RightSquare);

                    expr = new Expr.IndexedGet(expr, index, closingSquare);
                } else if (match(Lexeme.Dot)) {
                    while (match(Lexeme.Newline));

                    let name = consume("Expected property name after '.'", Lexeme.Identifier) as Identifier;

                    expr = new Expr.DottedGet(expr, name);
                } else {
                    break;
                }
            }

            return expr;
        }

        function finishCall(callee: Expression): Expression {
            let args = [];
            while(match(Lexeme.Newline));

            if (!check(Lexeme.RightParen)) {
                do {
                    while (match(Lexeme.Newline));

                    if (args.length >= Expr.Call.MaximumArguments) {
                        addError(
                            new ParseError(peek(), `Cannot have more than ${Expr.Call.MaximumArguments} arguments`)
                        );
                        break;
                    }
                    args.push(expression());
                } while (match(Lexeme.Comma));
            }

            while (match(Lexeme.Newline));
            const closingParen = consume("Expected ')' after function call arguments", Lexeme.RightParen);


            return new Expr.Call(callee, closingParen, args);
        }

        function primary(): Expression {
            switch (true) {
                case match(Lexeme.False): return new Expr.Literal(BrsBoolean.False, previous().location);
                case match(Lexeme.True): return new Expr.Literal(BrsBoolean.True, previous().location);
                case match(Lexeme.Invalid): return new Expr.Literal(BrsInvalid.Instance, previous().location);
                case match(
                    Lexeme.Integer,
                    Lexeme.LongInteger,
                    Lexeme.Float,
                    Lexeme.Double,
                    Lexeme.String
                ):
                    return new Expr.Literal(previous().literal!, previous().location);
                case match(Lexeme.Identifier):
                    return new Expr.Variable(previous() as Identifier);
                case match(Lexeme.LeftParen):
                    let left = previous();
                    let expr = expression();
                    let right = consume("Unmatched '(' - expected ')' after expression", Lexeme.RightParen);
                    return new Expr.Grouping(
                        { left, right },
                        expr
                    );
                case match(Lexeme.LeftSquare):
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

                    //consume("Expected newline or ':' after array literal", Lexeme.Newline, Lexeme.Colon, Lexeme.Eof);
                    return new Expr.ArrayLiteral(elements, openingSquare, closingSquare);
                case match(Lexeme.LeftBrace):
                    let openingBrace = previous();
                    let members: Expr.AAMember[] = [];

                    function key() {
                        let k;
                        if (check(Lexeme.Identifier)) {
                            k = new BrsString(advance().text!);
                        } else if (check(Lexeme.String)) {
                            k = advance().literal! as BrsString;
                        } else {
                            return addError(
                                new ParseError(
                                    peek(),
                                    `Expected identifier or string as associative array key, but received '${peek().text || ""}'`
                                )
                            );
                        }

                        consume("Expected ':' between associative array key and value", Lexeme.Colon);
                        return k;
                    }

                    while (match(Lexeme.Newline));

                    if (!match(Lexeme.RightBrace)) {
                        members.push({
                            name: key(),
                            value: expression()
                        });

                        while (match(Lexeme.Comma, Lexeme.Newline)) {
                            while (match(Lexeme.Newline));

                            if (check(Lexeme.RightBrace)) {
                                break;
                            }

                            members.push({
                                name: key(),
                                value: expression()
                            });
                        }

                        consume("Unmatched '{' - expected '}' after associative array literal", Lexeme.RightBrace);
                    }

                    let closingBrace = previous();

                    return new Expr.AALiteral(members, openingBrace, closingBrace);
                case match(Lexeme.Pos, Lexeme.Tab):
                    let token = Object.assign(previous(), { kind: Lexeme.Identifier }) as Identifier;
                    return new Expr.Variable(token);
                case check(Lexeme.Function, Lexeme.Sub):
                    return anonymousFunction();
                default:
                    return addError(
                        new ParseError(peek(), `Found unexpected token '${peek().text}'`)
                    );
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

        function consume(message: string, ...lexemes: Lexeme[]): Token {
            let foundLexeme = lexemes.map(lexeme => peek().kind === lexeme)
                .reduce(
                    (foundAny, foundCurrent) => foundAny || foundCurrent,
                    false
                );

            if (foundLexeme) { return advance(); }
            return addError(
                new ParseError(peek(), message)
            );
        }

        function advance(): Token {
            if (!isAtEnd()) { current++; }
            return previous();
        }

        function check(...lexemes: Lexeme[]) {
            if (isAtEnd()) { return false; }

            return lexemes.some(lexeme => peek().kind === lexeme);
        }

        function checkNext(...lexemes: Lexeme[]) {
            if (isAtEnd()) { return false; }

            return lexemes.some(lexeme => peekNext().kind === lexeme);
        }

        function isAtEnd() {
            return peek().kind === Lexeme.Eof;
        }

        function peekNext() {
            if (isAtEnd()) { return peek(); }
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
    }
}

