import * as fs from "fs";
import * as path from "path";
import pSettle from "p-settle";

import { Lexer } from "./lexer";
import { Parser, Stmt } from "./parser/";
import * as PP from "./preprocessor";

import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import * as BrsError from "./Error";
import { defaultExecutionOptions, ExecutionOptions } from "./interpreter";
import { ComponentScript } from "./scenegraph";

export function getLexerParserFn(
    manifest: Map<string, string>,
    options: Partial<ExecutionOptions>
) {
    const executionOptions = { ...defaultExecutionOptions, ...options };
    /**
     * Map file URIs or Source Content to promises. The promises resolve to an array of that script's statements.
     * This allows us to only parse each shared file once.
     */
    let memoizedStatements = new Map<string, Promise<Stmt.Statement[]>>();
    return async function parse(scripts: ComponentScript[]): Promise<Stmt.Statement[]> {
        async function lexAndParseScript(script: ComponentScript) {
            let contents;
            let filename;
            if (script.uri !== undefined) {
                filename = script.uri.replace(/[\/\\]+/g, path.posix.sep);
                try {
                    contents = fs.readFileSync(filename, "utf-8");
                } catch (err) {
                    let errno = (err as NodeJS.ErrnoException)?.errno || -4858;
                    return Promise.reject({
                        message: `brs: can't open file '${filename}': [Errno ${errno}]`,
                    });
                }
            } else if (script.content !== undefined) {
                contents = script.content;
                filename = script.xmlPath || "xml";
            } else {
                return Promise.reject({ message: "brs: invalid script object" });
            }
            let lexer = new Lexer();
            let preprocessor = new PP.Preprocessor();
            let parser = new Parser();
            [lexer, preprocessor, parser].forEach((emitter) =>
                emitter.onError(BrsError.getLoggerUsing(executionOptions.stderr))
            );

            let scanResults = lexer.scan(contents, filename);
            if (scanResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred during lexing",
                });
            }

            let preprocessResults = preprocessor.preprocess(scanResults.tokens, manifest);
            if (preprocessResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred during pre-processing",
                });
            }

            let parseResults = parser.parse(preprocessResults.processedTokens);
            if (parseResults.errors.length > 0) {
                return Promise.reject({
                    message: "Error occurred parsing",
                });
            }

            return Promise.resolve(parseResults.statements);
        }

        let promises: Promise<Stmt.Statement[]>[] = [];
        for (let script of scripts) {
            if (script.uri !== undefined) {
                let maybeStatements = memoizedStatements.get(script.uri);
                if (maybeStatements) {
                    promises.push(maybeStatements);
                } else {
                    let statementsPromise = lexAndParseScript(script);
                    if (!memoizedStatements.has(script.uri)) {
                        memoizedStatements.set(script.uri, statementsPromise);
                    }
                    promises.push(statementsPromise);
                }
            } else if (script.content !== undefined) {
                promises.push(lexAndParseScript(script));
            }
        }
        let parsedScripts = await pSettle(promises);

        // don't execute anything if there were reading, lexing, or parsing errors
        if (parsedScripts.some((script) => script.isRejected)) {
            return Promise.reject({
                messages: parsedScripts
                    .filter((script) => script.isRejected)
                    .map((rejection) => rejection.reason.message),
            });
        }

        // combine statements from all scripts into one array
        return parsedScripts
            .map((script) => script.value || [])
            .reduce((allStatements, fileStatements) => [...allStatements, ...fileStatements], []);
    };
}
