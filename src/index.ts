import { Lexer } from "./lexer";
import * as PP from "./preprocessor";
import { Parser } from "./parser";
import { Interpreter, ExecutionOptions, defaultExecutionOptions } from "./interpreter";
import * as BrsError from "./Error";
import * as bslCore from "raw-loader!../bsl/v30/bslCore.brs";
import * as bslDefender from "raw-loader!../bsl/v30/bslDefender.brs";
import * as models from "raw-loader!../bsl/models.csv";
import * as _lexer from "./lexer";
export { _lexer as lexer };
import * as BrsTypes from "./brsTypes";
export { BrsTypes as types };
export { PP as preprocessor };
import * as _parser from "./parser";
export { _parser as parser };
import { createDir, writeFile } from "./stdlib/File";

export const fileSystem = new Map<string, any>();
export const control = new Map<string, Int32Array>();

onmessage = function(event) {
    if (event.data.device) {
        const interpreter = new Interpreter();
        interpreter.onError(logError);
        // Registry
        let registry = event.data.device.registry;
        registry.forEach(function(value: string, key: string) {
            interpreter.registry.set(key, value);
        });
        // DeviceInfo
        interpreter.deviceInfo.set("developerId", event.data.device.developerId);
        interpreter.deviceInfo.set("deviceModel", event.data.device.deviceModel);
        interpreter.deviceInfo.set("clientId", event.data.device.clientId);
        interpreter.deviceInfo.set("countryCode", event.data.device.countryCode);
        interpreter.deviceInfo.set("timeZone", event.data.device.timeZone);
        interpreter.deviceInfo.set("locale", event.data.device.locale);
        interpreter.deviceInfo.set("clockFormat", event.data.device.clockFormat);
        interpreter.deviceInfo.set("displayMode", event.data.device.displayMode);
        interpreter.deviceInfo.set("models", parseCSV(models.default));
        // File System
        const bslFiles = new Map<string, string>();
        const pkgFiles = new Map<string, any>();
        const tmpFiles = new Map<string, any>();
        const source = new Map<string, string>();
        bslFiles.set("LibCore/v30/bslCore.brs", bslCore.default);
        bslFiles.set("LibCore/v30/bslDefender.brs", bslDefender.default);
        createDir(interpreter, "pkg:/source");
        createDir(interpreter, "pkg:/images");
        for (let index = 0; index < event.data.paths.length; index++) {
            let path = event.data.paths[index];
            if (path.type === "image") {
                pkgFiles.set(path.url, event.data.images[path.id]);
                if (path.url.substr(0, 6) === "images" && event.data.texts[path.id]) {
                    writeFile(interpreter, "pkg:/" + path.url, event.data.texts[path.id]);
                }
            } else if (path.type === "text") {
                pkgFiles.set(path.url, event.data.texts[path.id]);
            } else {
                source.set(path.url, event.data.brs[path.id]);
                writeFile(interpreter, "pkg:/" + path.url, event.data.texts[path.id]);
            }
        }
        fileSystem.set("common:", bslFiles);
        fileSystem.set("pkg:", pkgFiles);
        fileSystem.set("tmp:", tmpFiles);
        // Run Channel
        run(source, interpreter);
    } else {
        // Setup Control Shared Array
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
    const bsl = new Map<string, boolean>();
    bsl.set("v30/bslDefender.brs", false);
    bsl.set("v30/bslCore.brs", false);
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
            bsl.set("v30/bslDefender.brs", true);
            bsl.set("v30/bslCore.brs", true);
        }
        if (parseResults.libraries.get("v30/bslCore.brs") === true) {
            bsl.set("v30/bslCore.brs", true);
        }
        allStatements.push(...parseResults.statements);
    });
    if (bsl.get("v30/bslDefender.brs") === true) {
        const libScan = lexer.scan(bslDefender.default, "v30/bslDefender.brs");
        const libParse = parser.parse(libScan.tokens);
        allStatements.push(...libParse.statements);
    }
    if (bsl.get("v30/bslCore.brs") === true) {
        const libScan = lexer.scan(bslCore.default, "v30/bslCore.brs");
        const libParse = parser.parse(libScan.tokens);
        allStatements.push(...libParse.statements);
    }
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

function parseCSV(csv: string): Map<string, string[]> {
    let result = new Map<string, string[]>();
    let lines = csv.match(/[^\r\n]+/g);
    if (lines) {
        lines.forEach(line => {
            let fields = line.split(",");
            result.set(fields[0], [fields[1], fields[2], fields[3], fields[4]]);
        });
    }
    return result;
}
