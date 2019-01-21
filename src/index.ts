import * as fs from "fs";
import * as readline from "readline";
import promisify from "pify";
import pSettle from "p-settle";
const readFile = promisify(fs.readFile);

import { Token, Lexer } from "./lexer";
import * as PP from "./preprocessor";
import * as Parser from "./parser";
import { Interpreter, ExecutionOptions, defaultExecutionOptions } from "./interpreter";
import * as BrsError from "./Error";

export { Lexeme, Token, Lexer } from "./lexer";
import * as BrsTypes from "./brsTypes";
export { BrsTypes };
export { PP as Preprocessor };
export { Parser };


/**
 * Executes a BrightScript file by path and writes its output to the streams
 * provided in `options`.
 *
 * @param filename the absolute path to the `.brs` file to be executed
 * @param options configuration for the execution, including the streams to use for `stdout` and
 *                `stderr` and the base directory for path resolution
 *
 * @returns a `Promise` that will be resolve if `filename` is successfully
 *          executed, or be rejected if an error occurs.
 */
export async function execute(filenames: string[], options: Partial<ExecutionOptions>) {
    const executionOptions = Object.assign(defaultExecutionOptions, options);
    const interpreter = new Interpreter(executionOptions); // shared between files

    let manifest = await PP.getManifest(executionOptions.root);

    // wait for all files to be read, lexed, and parsed, but don't exit on the first error
    let parsedFiles = await pSettle(filenames.map(async (filename) => {
        let contents;
        try {
            contents = await readFile(filename, "utf-8");
        } catch (err) {
            return Promise.reject({
                message: `brs: can't open file '${filename}': [Errno ${err.errno}]`
            });
        }

        let lexer = new Lexer();
        let preprocessor = new PP.Preprocessor();

        let tokens = lexer.scan(contents);
        let processedTokens = preprocessor.preprocess(tokens, manifest);
        let statements = Parser.parse(processedTokens);

        if (BrsError.found()) {
            return Promise.reject({
                message: "Error occurred"
            });
        }

        return Promise.resolve(statements || []);
    }));

    // don't execute anything if there were reading, lexing, or parsing errors
    if (parsedFiles.some(file => file.isRejected)) {
        return Promise.reject({
            messages: parsedFiles.filter(file => file.isRejected).map(rejection => rejection.reason.message)
        });
    }

    // combine statements from all files into one array
    let statements = parsedFiles.map(file => file.value || []).reduce(
        (allStatements, fileStatements) => [ ...allStatements, ...fileStatements ],
        []
    );

    // execute them
    return interpreter.exec(statements);
}

/**
 * Launches an interactive read-execute-print loop, which reads input from
 * `stdin` and executes it.
 *
 * **NOTE:** Currently limited to single-line inputs :(
 */
export function repl() {
    const replInterpreter = new Interpreter();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.setPrompt("brs> ");

    rl.on("line", (line) => {
        let results = run(line, defaultExecutionOptions, replInterpreter);
        if (results) {
            results.map(result => console.log(result.toString()));
        }

        BrsError.reset();
        rl.prompt();
    });

    rl.prompt();
}

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
function run(contents: string, options: ExecutionOptions = defaultExecutionOptions, interpreter?: Interpreter) {
    const tokens: ReadonlyArray<Token> = Lexer.scan(contents);
    const statements = Parser.parse(tokens);

    if (BrsError.found()) {
        return;
    }

    if (!statements) { return; }

    try {
        return (interpreter || new Interpreter(options)).exec(statements);
    } catch (e) {
        //options.stderr.write(e.message);
        return;
    }
}
