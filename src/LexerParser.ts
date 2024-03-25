import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import pSettle from "p-settle";
const readFile = promisify(fs.readFile);

import { Lexer } from "./lexer";
import { Parser, Stmt } from "./parser";
import * as PP from "./preprocessor";

import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import { ManifestValue } from "./preprocessor/Manifest";
import * as BrsError from "./Error";
import { defaultExecutionOptions, ExecutionOptions } from "./interpreter";

export function getLexerParserFn(
    manifest: Map<string, ManifestValue>,
    options: Partial<ExecutionOptions>
) {
    const executionOptions = { ...defaultExecutionOptions, ...options };
    /**
     * Map file URIs to promises. The promises resolve to an array of that file's statements.
     * This allows us to only parse each file once.
     */
    let memoizedStatements = new Map<string, Promise<Stmt.Statement[]>>();
    return async function parse(filenames: string[]): Promise<Stmt.Statement[]> {
        async function lexAndParseFile(filename: string) {
            filename = filename.replace(/[\/\\]+/g, path.posix.sep);
            let contents;
            try {
                contents = await readFile(filename, "utf-8");
            } catch (err) {
                let errno = (err as NodeJS.ErrnoException)?.errno || -4858;
                return Promise.reject({
                    message: `brs: can't open file '${filename}': [Errno ${errno}]`,
                });
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

        let parsedFiles = await pSettle(
            filenames.map(async (filename) => {
                let maybeStatements = memoizedStatements.get(filename);
                if (maybeStatements) {
                    return maybeStatements;
                } else {
                    let statementsPromise = lexAndParseFile(filename);
                    if (!memoizedStatements.has(filename)) {
                        memoizedStatements.set(filename, statementsPromise);
                    }

                    return statementsPromise;
                }
            })
        );

        // don't execute anything if there were reading, lexing, or parsing errors
        if (parsedFiles.some((file) => file.isRejected)) {
            return Promise.reject({
                messages: parsedFiles
                    .filter((file) => file.isRejected)
                    .map((rejection) => rejection.reason.message),
            });
        }

        // combine statements from all files into one array
        return parsedFiles
            .map((file) => file.value || [])
            .reduce((allStatements, fileStatements) => [...allStatements, ...fileStatements], []);
    };
}
