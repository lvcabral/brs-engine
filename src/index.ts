//import * as fs from "fs";
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

export const images = new Map<string, ImageData>();
export const frame = { flag: true };

onmessage = function(event) {
    if (event.data.brs) {
        const replInterpreter = new Interpreter();
        replInterpreter.onError(logError);
        for (let index = 0; index < event.data.urls.length; index++) {
            images.set(event.data.urls[index], event.data.images[index]);
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
 * Logs a detected BRS error to stderr.
 * @param err the error to log to `stderr`
 */
function logError(err: BrsError.BrsError) {
    console.error(err.format());
}
