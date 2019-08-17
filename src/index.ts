import * as fs from "fs";
//import * as readline from "readline";
//import { promisify } from "util";
//import pSettle from "p-settle";
//const readFile = promisify(fs.readFile);

import { Lexer } from "./lexer";
import * as PP from "./preprocessor";
import { Parser } from "./parser";
import { Interpreter, ExecutionOptions, defaultExecutionOptions } from "./interpreter";
import * as BrsError from "./Error";

import * as _lexer from "./lexer";
export { _lexer as lexer };
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import * as _parser from "./parser";
export { _parser as parser };

export const images = new Map<string, ImageBitmap>();
export const frame = { flag: true };

onmessage = function(event) {
    if (event.data.brs) {
        const replInterpreter = new Interpreter();
        replInterpreter.onError(logError);
        for (let index = 0; index < event.data.paths.length; index++) {
            images.set(event.data.paths[index], event.data.images[index]);
        }
        run(event.data.brs, defaultExecutionOptions, replInterpreter);
    } else if (event.data.frame) {
        frame.flag = true;
    }
};

/**
 * Runs an arbitrary string of BrightScript code.
 * @param contents the BrightScript code to lex, parse, and interpret.
 * @param options the streams to use for `stdout` and `stderr`. Mostly used for
 *                testing.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @returns an array of statement execution results, indicating why each
 *          statement exited and what its return value was, or `undefined` if
 *          `interpreter` threw an Error.
 */
function run(
    contents: string,
    options: ExecutionOptions = defaultExecutionOptions,
    interpreter: Interpreter
) {
    const lexer = new Lexer();
    const parser = new Parser();

    lexer.onError(logError);
    parser.onError(logError);

    const scanResults = lexer.scan(contents, "REPL");
    if (scanResults.errors.length > 0) {
        return;
    }

    const parseResults = parser.parse(scanResults.tokens);
    if (parseResults.errors.length > 0) {
        return;
    }

    if (parseResults.statements.length === 0) {
        return;
    }

    try {
        return interpreter.exec(parseResults.statements);
    } catch (e) {
        console.error(e.message);
        return;
    }
}

/**
 * A synchronous version of `execute`. Executes a BrightScript file by path and writes its output to the streams
 * provided in `options`.
 *
 * @param filename the paths to BrightScript files to execute synchronously
 * @param options configuration for the execution, including the streams to use for `stdout` and
 *                `stderr` and the base directory for path resolution
 * @param args the set of arguments to pass to the `main` function declared in one of the provided filenames
 *
 * @returns the value returned by the executed file(s)
 */
export function executeSync(
    filenames: string[],
    options: Partial<ExecutionOptions>,
    args: BrsTypes.BrsType[]
) {
    const executionOptions = Object.assign(defaultExecutionOptions, options);
    const interpreter = new Interpreter(executionOptions); // shared between files

    let manifest = PP.getManifestSync(executionOptions.root);

    let allStatements = filenames
        .map(filename => {
            let contents = fs.readFileSync(filename, "utf8");
            let scanResults = Lexer.scan(contents, filename);
            let preprocessor = new PP.Preprocessor();
            let preprocessorResults = preprocessor.preprocess(scanResults.tokens, manifest);
            return Parser.parse(preprocessorResults.processedTokens).statements;
        })
        .reduce((allStatements, statements) => [...allStatements, ...statements], []);

    return interpreter.exec(allStatements, ...args);
}

/**
 * Logs a detected BRS error to stderr.
 * @param err the error to log to `stderr`
 */
function logError(err: BrsError.BrsError) {
    console.error(err.format());
}

function makeRequest(url: string): ArrayBuffer {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false); // Note: synchronous
    xhr.responseType = "arraybuffer";
    xhr.send();
    return xhr.response;
}
