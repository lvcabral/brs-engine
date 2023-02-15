import { Interpreter } from ".";
import { BackTrace, Environment, Scope } from "./Environment";
import { shared, source } from "..";
import { Lexer, Location } from "../lexer";
import { Parser, Stmt } from "../parser";
import { isIterable, PrimitiveKinds, ValueKind } from "../brsTypes";
import { Assignment, DottedSet, ForEach, Print } from "../parser/Statement";

// Debug Constants
enum debugCommand {
    BT,
    CONT,
    EXIT,
    HELP,
    LAST,
    LIST,
    NEXT,
    STEP,
    THREADS,
    VAR,
    EXPR,
}
const dataBufferIndex = 32;
let stepMode = false;

export function runDebugger(interpreter: Interpreter, statement: Stmt.Statement): boolean {
    // TODO:
    // - Implement help
    // - Implement support for break with Ctrl+C
    // - Prevent error when exit is called
    // - Check if possible to enable aa.addReplace()
    const env = interpreter.environment;
    const lexer = new Lexer();
    const parser = new Parser();
    const lines = parseTextFile(source.get(statement.location.file));
    const backTrace = env.getBackTrace();
    const buffer = shared.get("buffer") || new Int32Array([]);
    const prompt = "Brightscript Debugger> ";

    let debugMsg = "BrightScript Micro Debugger.\r\n";
    let line: number = statement.location.start.line;
    if (stepMode) {
        postMessage(`print,${line.toString().padStart(3, "0")}: ${lines[line - 1]}\r\n`);
    } else {
        debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

        debugMsg += "\r\nCurrent Function:\r\n";
        let start = Math.max(line - 8, 1);
        let end = Math.min(line + 5, lines.length);
        for (let index = start; index < end; index++) {
            const flag = index === line ? "*" : " ";
            debugMsg += `${index.toString().padStart(3, "0")}:${flag} ${lines[index - 1]}\r\n`;
        }
        debugMsg += "Source Digest(s):\r\n";
        debugMsg += `pkg: dev ${interpreter.getChannelVersion()} 5c04534a `;
        debugMsg += `${interpreter.manifest.get("title")}\r\n\r\n`;

        debugMsg += `STOP (runtime error &hf7) in ${formatLocation(statement.location)}\r\n`;
        debugMsg += "Backtrace: \r\n";
        postMessage(`print,${debugMsg}`);
        debugBackTrace(backTrace, statement.location);
        postMessage(`print,Local variables:\r\n`);
        debugLocalVariables(env);
    }
    // Debugger Loop
    while (true) {
        postMessage(`print,\r\n${prompt}`);
        Atomics.wait(buffer, interpreter.type.DBG, -1);
        let cmd = Atomics.load(buffer, interpreter.type.DBG);
        Atomics.store(buffer, interpreter.type.DBG, -1);
        if (cmd === debugCommand.EXPR) {
            let expr = debugGetExpr(buffer);
            const exprScan = lexer.scan(expr, "debug");
            const exprParse = parser.parse(exprScan.tokens);
            if (exprParse.statements.length > 0) {
                const exprStmt = exprParse.statements[0];
                try {
                    if (exprStmt instanceof Assignment) {
                        interpreter.visitAssignment(exprStmt);
                    } else if (exprStmt instanceof DottedSet) {
                        interpreter.visitDottedSet(exprStmt);
                    } else if (exprStmt instanceof Print) {
                        interpreter.visitPrint(exprStmt);
                    } else if (exprStmt instanceof ForEach) {
                        interpreter.visitForEach(exprStmt);
                    } else {
                        postMessage(`print,Debug command/expression not supported!\r\n`);
                    }
                } catch (err: any) {
                    // ignore to avoid crash
                }
            } else {
                postMessage("error,Syntax Error. (compile error &h02) in $LIVECOMPILE");
            }
            continue;
        }
        if (Atomics.load(buffer, interpreter.type.EXP)) {
            postMessage("warning,Unexpected parameter");
            continue;
        }
        switch (cmd) {
            case debugCommand.BT:
                debugBackTrace(backTrace, statement.location);
                break;
            case debugCommand.CONT:
                stepMode = false;
                interpreter.debugMode = false;
                return true;
            case debugCommand.STEP:
                stepMode = true;
                interpreter.debugMode = true;
                return true;
            case debugCommand.EXIT:
                return false;
            case debugCommand.LAST:
                postMessage(`print,${line.toString().padStart(3, "0")}: ${lines[line - 1]}\r\n`);
                break;
            case debugCommand.LIST:
                if (backTrace.length > 0) {
                    const func = backTrace[backTrace.length - 1];
                    let start = func.functionLoc.start.line;
                    let end = Math.min(func.functionLoc.end.line, lines.length);
                    for (let index = start; index <= end; index++) {
                        const flag = index === line ? "*" : " ";
                        postMessage(
                            `print,${index.toString().padStart(3, "0")}:${flag} ${
                                lines[index - 1]
                            }\r\n`
                        );
                    }
                }
                break;
            case debugCommand.NEXT:
                postMessage(`print,${(line + 1).toString().padStart(3, "0")}: ${lines[line]}\r\n`);
                break;
            case debugCommand.THREADS:
                debugMsg = "ID    Location                                Source Code\r\n";
                debugMsg += `0*    ${formatLocation(statement.location).padEnd(40)}${
                    lines[line - 1]
                }\r\n`;
                debugMsg += " *selected";
                postMessage(`print,${debugMsg}\r\n`);
                break;
            case debugCommand.VAR:
                debugLocalVariables(env);
                break;
            default:
                postMessage(`warning,Invalid Debug command/expression!\r\n`);
                break;
        }
    }
}

function debugGetExpr(buffer: Int32Array): string {
    let expr = "";
    buffer.slice(dataBufferIndex).every((char) => {
        if (char > 0) {
            expr += String.fromCharCode(char).toLocaleLowerCase();
        }
        return char; // if \0 stops decoding
    });
    return expr;
}

function debugBackTrace(backTrace: BackTrace[], stmtLoc: Location) {
    let debugMsg = "";
    let offset = 1;
    let loc = stmtLoc;
    for (let index = backTrace.length - 1; index >= 0; index--) {
        const func = backTrace[index];
        const kind = ValueKind.toString(func.signature.returns);
        let args = "";
        func.signature.args.forEach((arg) => {
            args += args !== "" ? "," : "";
            args += `${arg.name.text} As ${ValueKind.toString(arg.type.kind)}`;
        });
        debugMsg += `#${index}  Function ${func.functionName}(${args}) As ${kind}\r\n`; // TODO: Correct signature
        debugMsg += `   file/line: ${formatLocation(loc, offset)}\r\n`;
        loc = func.callLoc;
        offset = 0;
    }
    postMessage(`print,${debugMsg}`);
}

function debugLocalVariables(environment: Environment) {
    let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
    debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
        environment.getM().getElements().length
    }\r\n`;
    let fnc = environment.getList(Scope.Function);
    fnc.forEach((value, key) => {
        if (PrimitiveKinds.has(value.kind)) {
            debugMsg += `${key.padEnd(16)} ${ValueKind.toString(
                value.kind
            )} val:${value.toString()}\r\n`;
        } else if (isIterable(value)) {
            debugMsg += `${key.padEnd(16)} ${value.getComponentName()} count:${
                value.getElements().length
            }\r\n`;
        } else if (value.kind === ValueKind.Object) {
            debugMsg += `${key.padEnd(17)}${value.getComponentName()}\r\n`;
        } else {
            debugMsg += `${key.padEnd(17)}${value.toString()}\r\n`;
        }
    });
    postMessage(`print,${debugMsg}`);
}

function formatLocation(location: Location, lineOffset: number = 0) {
    let formattedLocation: string;
    if (location.start.line) {
        formattedLocation = `pkg:/${location.file}(${location.start.line + lineOffset})`;
    } else {
        formattedLocation = `pkg:/${location.file}(??)`;
    }
    return formattedLocation;
}

// This function takes a text file content as a string and returns an array of lines
function parseTextFile(content?: string): Array<string> {
    let lines: Array<string> = [];
    if (content) {
        lines = content.split("\n");
    }
    return lines;
}
