import { Interpreter } from ".";
import { BackTrace, Environment, Scope } from "./Environment";
import { source } from "..";
import { Lexer, Location } from "../lexer";
import { Parser } from "../parser";
import { isIterable, PrimitiveKinds, ValueKind } from "../brsTypes";
import {
    Assignment,
    DottedSet,
    Expression,
    ForEach,
    Increment,
    IndexedSet,
    Print,
} from "../parser/Statement";
import { DataType, DebugCommand } from "../enums";

// Debug Constants
let stepMode = false;

export function runDebugger(
    interpreter: Interpreter,
    nextLoc: Location,
    lastLoc: Location,
    error?: string
) {
    // TODO:
    // - Implement step over and step out
    // - Implement classes, bsc(s) and stats
    const env = interpreter.environment;
    const lastLines = parseTextFile(source.get(lastLoc.file));
    const prompt = "Brightscript Debugger> ";
    let debugMsg = "BrightScript Micro Debugger.\r\n";
    let lastLine: number = lastLoc.start.line;
    if (stepMode) {
        postMessage(
            `print,${lastLine.toString().padStart(3, "0")}: ${lastLines[lastLine - 1]}\r\n`
        );
    } else {
        postMessage("debug,stop");
        debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

        debugMsg += "\r\nCurrent Function:\r\n";
        let start = Math.max(lastLine - 8, 1);
        let end = Math.min(lastLine + 5, lastLines.length);
        for (let index = start; index < end; index++) {
            const flag = index === lastLine ? "*" : " ";
            debugMsg += `${index.toString().padStart(3, "0")}:${flag} ${lastLines[index - 1]}\r\n`;
        }
        debugMsg += "Source Digest(s):\r\n";
        debugMsg += `pkg: dev ${interpreter.getChannelVersion()} 5c04534a `;
        debugMsg += `${interpreter.manifest.get("title")}\r\n\r\n`;
        debugMsg += `${error ?? "STOP"} (runtime error &hf7) in ${interpreter.formatLocation()}`;

        debugMsg += "\r\nBacktrace: \r\n";
        postMessage(`print,${debugMsg}`);
        debugBackTrace(interpreter, nextLoc);
        postMessage(`print,Local variables:\r\n`);
        debugLocalVariables(env);
    }
    // Debugger Loop
    while (true) {
        postMessage(`print,\r\n${prompt}`);
        Atomics.wait(interpreter.sharedArray, DataType.DBG, -1);
        let cmd = Atomics.load(interpreter.sharedArray, DataType.DBG);
        Atomics.store(interpreter.sharedArray, DataType.DBG, -1);
        if (cmd === DebugCommand.EXPR) {
            debugHandleExpr(interpreter);
            continue;
        }
        switch (cmd) {
            case DebugCommand.CONT:
                if (error) {
                    postMessage("print,Can't continue");
                    continue;
                }
                stepMode = false;
                interpreter.debugMode = false;
                postMessage("debug,continue");
                return true;
            case DebugCommand.STEP:
                if (error) {
                    postMessage("print,Can't continue");
                    continue;
                }
                stepMode = true;
                interpreter.debugMode = true;
                return true;
            case DebugCommand.EXIT:
                return false;
        }
        debugHandleCommand(interpreter, nextLoc, lastLoc, cmd);
    }
}

function debugHandleExpr(interpreter: Interpreter) {
    const lexer = new Lexer();
    const parser = new Parser();
    interpreter.debugMode = false;
    let expr = interpreter.readDataBuffer();
    const exprScan = lexer.scan(`${expr}\n`, "debug");
    if (exprScan.errors.length > 0) {
        postMessage(`error,${exprScan.errors[0].message}`);
        return;
    }
    const exprParse = parser.parse(exprScan.tokens);
    if (exprParse.errors.length > 0) {
        postMessage(`error,${exprParse.errors[0].message}`);
        return;
    }
    if (exprParse.statements.length > 0) {
        const exprStmt = exprParse.statements[0];
        try {
            if (exprStmt instanceof Assignment) {
                interpreter.visitAssignment(exprStmt);
            } else if (exprStmt instanceof DottedSet) {
                interpreter.visitDottedSet(exprStmt);
            } else if (exprStmt instanceof IndexedSet) {
                interpreter.visitIndexedSet(exprStmt);
            } else if (exprStmt instanceof Print) {
                interpreter.visitPrint(exprStmt);
            } else if (exprStmt instanceof Expression) {
                interpreter.visitExpression(exprStmt);
            } else if (exprStmt instanceof Increment) {
                interpreter.visitIncrement(exprStmt);
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
}

function debugHandleCommand(
    interpreter: Interpreter,
    currLoc: Location,
    lastLoc: Location,
    cmd: number
) {
    const env = interpreter.environment;
    const backTrace = env.getBackTrace();
    const lastLines = parseTextFile(source.get(lastLoc.file));
    const currLines = parseTextFile(source.get(currLoc.file));
    let lastLine: number = lastLoc.start.line;
    let currLine: number = currLoc.start.line;
    let debugMsg: string;
    switch (cmd) {
        case DebugCommand.BT:
            debugBackTrace(interpreter, currLoc);
            break;
        case DebugCommand.HELP:
            debugHelp();
            break;
        case DebugCommand.LAST:
            postMessage(
                `print,${lastLine.toString().padStart(3, "0")}: ${lastLines[lastLine - 1]}\r\n`
            );
            break;
        case DebugCommand.LIST: {
            const flagLine = currLoc.file === lastLoc.file ? lastLine : currLine;
            debugList(backTrace, currLines, flagLine);
            break;
        }
        case DebugCommand.NEXT:
            postMessage(
                `print,${currLine.toString().padStart(3, "0")}: ${currLines[currLine - 1]}\r\n`
            );
            break;
        case DebugCommand.THREAD:
            debugMsg = "Thread selected: ";
            debugMsg += ` 0*   ${interpreter.formatLocation(currLoc).padEnd(40)}${lastLines[
                lastLine - 1
            ].trim()}`;
            postMessage(`print,${debugMsg}\r\n`);
            break;
        case DebugCommand.THREADS:
            debugMsg = "ID    Location                                Source Code\r\n";
            debugMsg += ` 0*   ${interpreter.formatLocation(currLoc).padEnd(40)}${lastLines[
                lastLine - 1
            ].trim()}\r\n`;
            debugMsg += "  *selected";
            postMessage(`print,${debugMsg}\r\n`);
            break;
        case DebugCommand.VAR:
            debugLocalVariables(env);
            break;
        case DebugCommand.BREAK:
            postMessage(`warning,Micro Debugger already running!\r\n`);
            break;
        case DebugCommand.PAUSE:
            break;
        default:
            postMessage(`warning,Invalid Debug command/expression!\r\n`);
            break;
    }
}

function debugBackTrace(interpreter: Interpreter, stmtLoc: Location) {
    const backTrace = interpreter.environment.getBackTrace();
    let debugMsg = "";
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
        debugMsg += `   file/line: ${interpreter.formatLocation(loc)}\r\n`;
        loc = func.callLoc;
    }
    postMessage(`print,${debugMsg}`);
}

function debugList(backTrace: BackTrace[], currLines: string[], flagLine: number) {
    if (backTrace.length > 0) {
        const func = backTrace[backTrace.length - 1];
        const start = func.functionLoc.start.line;
        const end = Math.min(func.functionLoc.end.line, currLines.length);
        for (let index = start; index <= end; index++) {
            let flag = index === flagLine ? "*" : " ";
            postMessage(
                `print,${index.toString().padStart(3, "0")}:${flag} ${currLines[index - 1]}\r\n`
            );
        }
    }
}

function debugLocalVariables(environment: Environment) {
    let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
    debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
        environment.getM().getElements().length
    }\r\n`;
    let fnc = environment.getList(Scope.Function);
    fnc.forEach((value, key) => {
        if (PrimitiveKinds.has(value.kind)) {
            let text = value.toString();
            let lf = text.length <= 94 ? "\r\n" : "...\r\n";
            if (value.kind === ValueKind.String) {
                text = `"${text.substring(0, 94)}"`;
            }
            debugMsg += `${key.padEnd(16)} ${ValueKind.toString(
                value.kind
            )} val:${text}${lf}`;
        } else if (isIterable(value)) {
            debugMsg += `${key.padEnd(16)} ${value.getComponentName()} count:${
                value.getElements().length
            }\r\n`;
        } else if (value.kind === ValueKind.Object) {
            debugMsg += `${key.padEnd(17)}${value.getComponentName()}\r\n`;
        } else {
            debugMsg += `${key.padEnd(17)}${value.toString().substring(0,94)}\r\n`;
        }
    });
    postMessage(`print,${debugMsg}`);
}

function debugHelp() {
    let debugMsg = "";

    debugMsg += "Command List:\r\n";
    debugMsg += "   bt              Print backtrace of call function context frames\r\n";
    // debugMsg += "   brkd            Break on BrightScript diagnostics\r\n"
    // debugMsg += "   classes         List public classes\r\n"
    debugMsg += "   cont|c          Continue script execution\r\n";
    // debugMsg += "   down|d          Move down the function context chain one\r\n"
    debugMsg += "   exit|q          Exit shell\r\n";
    // debugMsg += "   gc              Run garbage collector\r\n"
    debugMsg += "   last|l          Show last line that executed\r\n";
    debugMsg += "   next|n          Show the next line to execute\r\n";
    debugMsg += "   list            List current function\r\n";
    // debugMsg += "   bsc             List BrightScript Component instances\r\n"
    // debugMsg += "   bscs            Summarize BrightScript Component instances\r\n"
    // debugMsg += "   stats           Shows statistics\r\n"
    debugMsg += "   step|s|t        Step one program statement\r\n";
    debugMsg += "   thread|th       Show selected thread\r\n";
    // debugMsg += "   thread|th <id>  Select one thread for inspection\r\n"
    debugMsg += "   threads|ths     List all threads of execution\r\n";
    debugMsg += "   over|v          Step over one program statement (for now act as step)\r\n";
    debugMsg += "   out|o           Step out from current function (for now act as step)\r\n";
    // debugMsg += "   up|u            Move up the function context chain one\r\n"
    debugMsg += "   var             Display local variables and their types/values\r\n";
    debugMsg += "   print|p|?       Print variable value or expression\r\n\r\n";
    debugMsg += "   Type any expression for a live compile and run, in the context\r\n";
    debugMsg += "   of the current function.  Put the 'stop' statement in your code\r\n";
    debugMsg += "   to trigger a breakpoint.  Then use 'c', 's', or other commands.\r\n";
    postMessage(`print,${debugMsg}`);
}

// This function takes a text file content as a string and returns an array of lines
function parseTextFile(content?: string): string[] {
    let lines: string[] = [];
    if (content) {
        lines = content.split("\n");
    }
    return lines;
}
