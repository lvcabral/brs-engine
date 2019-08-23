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
import * as bslCore from "raw-loader!../bsl/v30/bslCore.brs";
import * as bslDefender from "raw-loader!../bsl/v30/bslDefender.brs";

import * as _lexer from "./lexer";
export { _lexer as lexer };
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import * as _parser from "./parser";
export { _parser as parser };

export const images = new Map<string, ImageBitmap>();
export const texts = new Map<string, string>();
export const frame = { flag: true };
export const control = new Map<string, Int32Array>();

onmessage = function(event) {
    const source = new Map<string, string>();
    if (event.data.brs) {
        const replInterpreter = new Interpreter();
        replInterpreter.onError(logError);
        for (let index = 0; index < event.data.paths.length; index++) {
            let path = event.data.paths[index];
            if (path.type === "image") {
                images.set(path.url, event.data.images[path.id]);
            } else if (path.type === "text") {
                texts.set(path.url, event.data.texts[path.id]);
            } else {
                source.set(path.url, event.data.brs[path.id]);
            }
        }
        run(source, replInterpreter);
    } else {
        control.set("keys", new Int32Array(event.data));
    }
};

/**
 * Runs an arbitrary string of BrightScript code.
 * @param source array of BrightScript code to lex, parse, and interpret.
 * @param interpreter an interpreter to use when executing `contents`. Required
 *                    for `repl` to have persistent state between user inputs.
 * @returns an array of statement execution results, indicating why each
 *          statement exited and what its return value was, or `undefined` if
 *          `interpreter` threw an Error.
 */
function run(source: Map<string, string>, interpreter: Interpreter) {
    const lexer = new Lexer();
    const parser = new Parser();
    const allStatements = new Array<_parser.Stmt.Statement>();
    lexer.onError(logError);
    parser.onError(logError);
    source.forEach(function(code, path) {
        const scanResults = lexer.scan(code, path);
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
        if (parseResults.libraries.get("v30/bslDefender.brs") === true) {
            const libScan = lexer.scan(bslDefender.default, "v30/bslDefender.brs");
            const libParse = parser.parse(libScan.tokens);
            parseResults.libraries.set("v30/bslCore.brs", true);
            parseResults.statements = parseResults.statements.concat(libParse.statements);
        }

        if (parseResults.libraries.get("v30/bslCore.brs") === true) {
            const libScan = lexer.scan(bslCore.default, "v30/bslCore.brs");
            const libParse = parser.parse(libScan.tokens);
            parseResults.statements = parseResults.statements.concat(libParse.statements);
        }
        allStatements.push(...parseResults.statements);
    });

    try {
        return interpreter.exec(allStatements);
    } catch (e) {
        console.error(e.message);
        return;
    }
}

/**
 * Logs a detected BRS error to console.
 * @param err the error to log to `console`
 */
function logError(err: BrsError.BrsError) {
    console.error(err.format());
}
