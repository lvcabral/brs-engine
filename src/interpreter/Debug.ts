import { Interpreter } from ".";
import { Environment, Scope } from "./Environment";
import { shared } from "..";
import { Lexer } from "../lexer";
import { Parser, Stmt } from "../parser";
import { isIterable, PrimitiveKinds, ValueKind } from "../brsTypes";
import { Assignment, DottedSet, ForEach, Print } from "../parser/Statement";

// Debug Constants
export enum debugCommand {
    BT,
    CONT,
    EXIT,
    HELP,
    LAST,
    LIST,
    THREADS,
    VAR,
    EXPR,
}
const dataBufferIndex = 32;

export function startDebugger(interpreter: Interpreter, statement: Stmt.Stop): boolean {
    // TODO:
    // - Implement help
    // - Implement support for break with Ctrl+C
    // - Create a call stack to save position for each Callable call
    // - Create a isDebug flag and allow step by checking every Callable call
    // - Prevent error when exit is called
    // - Add lines of code to the list
    // - Show real backtrace or just one level
    // - Check if possible to enable aa.addReplace()
    const lexer = new Lexer();
    const parser = new Parser();

    const buffer = shared.get("buffer") || new Int32Array([]);
    const prompt = "Brightscript Debugger> ";
    const loc = statement.location;

    let debugMsg = "BrightScript Micro Debugger.\r\n";
    debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

    debugMsg += "\r\nCurrent Function:\r\n";
    let line: number = statement.location.start.line;
    for (let index = line - 8; index < line; index++) {
        debugMsg += `${index.toString().padStart(3, "0")}:      \r\n`;
    }
    debugMsg += `${line.toString().padStart(3, "0")}:*     stop\r\n`;
    for (let index = line + 1; index < line + 5; index++) {
        debugMsg += `${index.toString().padStart(3, "0")}:      \r\n`;
    }
    debugMsg += "Source Digest(s):\r\n";
    debugMsg += `pkg: dev ${interpreter.getChannelVersion()} 5c04534a `;
    debugMsg += `${interpreter.manifest.get("title")}\r\n\r\n`;

    debugMsg += `STOP (runtime error &hf7) in ${formatLocation(loc)}\r\n`;
    debugMsg += "Backtrace: \r\n";
    postMessage(`print,${debugMsg}`);
    debugBackTrace(loc);
    postMessage(`print,Local variables:\r\n`);
    debugLocalVariables(interpreter.environment);
    postMessage(`print,\r\n${prompt}`);

    let inDebug = true;
    while (inDebug) {
        Atomics.wait(buffer, interpreter.type.DBG, -1);
        let cmd = Atomics.load(buffer, interpreter.type.DBG);
        let exp = Atomics.load(buffer, interpreter.type.EXP);
        switch (cmd) {
            case debugCommand.BT:
                if (exp) {
                    postMessage("warning,Unexpected parameter");
                    break;
                }
                debugBackTrace(statement.location);
                break;
            case debugCommand.CONT:
                if (exp) {
                    postMessage("warning,Unexpected parameter");
                    break;
                }
                return true;
            case debugCommand.EXIT:
                if (exp) {
                    postMessage("warning,Unexpected parameter");
                    break;
                }
                inDebug = false;
                break;
            case debugCommand.THREADS:
                if (exp) {
                    postMessage("warning,Unexpected parameter");
                    break;
                }
                debugMsg = "ID    Location                                Source Code\r\n";
                debugMsg += `0*    ${formatLocation(loc).padEnd(40)}stop\r\n`;
                debugMsg += " *selected";
                postMessage(`print,${debugMsg}\r\n`);
                break;
            case debugCommand.VAR:
                if (exp) {
                    postMessage("warning,Unexpected parameter");
                    break;
                }
                debugLocalVariables(interpreter.environment);
                break;
            default:
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
                break;
        }
        Atomics.store(buffer, interpreter.type.DBG, -1);
        postMessage(`print,\r\n${prompt}`);
    }
    return false;
}

export function debugGetExpr(buffer: Int32Array): string {
    let expr = "";
    buffer.slice(dataBufferIndex).every((char) => {
        if (char > 0) {
            expr += String.fromCharCode(char).toLocaleLowerCase();
        }
        return char; // if \0 stops decoding
    });
    return expr;
}

export function debugBackTrace(location: any) {
    let debugMsg = `#1  Function ${"startmenu()"} As ${"Integer"}\r\n`;
    debugMsg += `   file/line: ${formatLocation(location, 1)}\r\n`;
    debugMsg += `#0  Function ${"main()"} As ${"Void"}\r\n`;
    debugMsg += `   file/line: ${"pkg:/source/gameMain.brs(90)\r\n"}`;
    postMessage(`print,${debugMsg}`);
}

export function debugLocalVariables(environment: Environment) {
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

export function formatLocation(location: any, lineOffset: number = 0) {
    let formattedLocation: string;
    if (location.start.line) {
        formattedLocation = `pkg:/${location.file}(${location.start.line + lineOffset})`;
    } else {
        formattedLocation = `pkg:/${location.file}(??)`;
    }
    return formattedLocation;
}
