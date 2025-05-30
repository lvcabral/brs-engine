import { bscs } from "..";
import { Interpreter, TracePoint } from ".";
import { Lexer, Location } from "../lexer";
import { Parser } from "../parser";
import { BrsDevice } from "../device/BrsDevice";
import { BrsError } from "../error/BrsError";
import { BrsObjects } from "../brsTypes";
import {
    Statement,
    Assignment,
    DottedSet,
    Expression,
    ForEach,
    Increment,
    IndexedSet,
    Print,
    Function,
    If,
    For,
    While,
} from "../parser/Statement";
import { DataType, DebugCommand, debugPrompt, numberToHex, parseTextFile } from "../common";
/// #if !BROWSER
import readline from "readline-sync";
readline.setDefaultOptions({ prompt: debugPrompt });
/// #endif

// Debug Constants
let stepMode = false;

/**
 * Main Debugger function
 * @param interpreter (Interpreter) - The interpreter instance
 * @param nextLoc (Location) - The next location to execute
 * @param lastLoc (Location) - The last location executed
 * @param errMessage (string) - The error message
 * @param errNumber (number) - The error number
 * @returns (boolean) - True if the execution should continue, false if it should exit
 */
export function runDebugger(
    interpreter: Interpreter,
    nextLoc: Location,
    lastLoc: Location,
    errMessage?: string,
    errNumber?: number
) {
    // Debugger Introduction Message
    debuggerIntro(interpreter, lastLoc, nextLoc, errMessage, errNumber);
    // Debugger Loop
    while (true) {
        let line = "";
        /// #if BROWSER
        line = nextDebugCommand(interpreter);
        /// #else
        BrsDevice.stdout.write(`print,\r\n`);
        line = readline.prompt();
        /// #endif
        const command = parseCommand(line);
        if (command.cmd === DebugCommand.EXPR) {
            debugHandleExpr(interpreter, command.expr);
            continue;
        }
        switch (command.cmd) {
            case DebugCommand.CONT:
                if (errMessage) {
                    BrsDevice.stdout.write("print,Can't continue");
                    continue;
                }
                stepMode = false;
                interpreter.debugMode = false;
                postMessage("debug,continue");
                return true;
            case DebugCommand.STEP:
                if (errMessage) {
                    BrsDevice.stdout.write("print,Can't continue");
                    continue;
                }
                stepMode = true;
                interpreter.debugMode = true;
                return true;
            case DebugCommand.EXIT:
                return false;
        }
        debugHandleCommand(interpreter, nextLoc, lastLoc, command.cmd);
    }
}

/**
 * Function to print the debugger introduction message
 * @param interpreter (Interpreter) - The interpreter instance
 * @param nextLoc (Location) - The next location to execute
 * @param lastLoc (Location) - The last location executed
 * @param errMessage (string) - The error message
 * @param errNumber (number) - The error number
 */
function debuggerIntro(
    interpreter: Interpreter,
    lastLoc: Location,
    nextLoc: Location,
    errMessage?: string,
    errNumber?: number
) {
    const lastLines = parseTextFile(interpreter.sourceMap.get(lastLoc.file));
    let debugMsg = "BrightScript Micro Debugger.\r\n";
    let lastLine: number = lastLoc.start.line;
    if (stepMode) {
        const line = lastLines[lastLine - 1].trimEnd();
        BrsDevice.stdout.write(`print,${lastLine.toString().padStart(3, "0")}: ${line}\r\n`);
    } else {
        postMessage("debug,stop");
        debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

        debugMsg += "\r\nCurrent Function:\r\n";
        let start = Math.max(lastLine - 8, 1);
        let end = Math.min(lastLine + 5, lastLines.length);
        for (let index = start; index < end; index++) {
            const flag = index === lastLine ? "*" : " ";
            const line = lastLines[index - 1].trimEnd();
            debugMsg += `${index.toString().padStart(3, "0")}:${flag} ${line}\r\n`;
        }
        debugMsg += "Source Digest(s):\r\n";
        debugMsg += `pkg: dev ${interpreter.getChannelVersion()} 5c04534a `;
        debugMsg += `${interpreter.manifest.get("title") || "brs"}\r\n\r\n`;
        debugMsg += `${errMessage ?? "STOP"} (runtime error &h${
            errNumber ? numberToHex(errNumber) : "f7"
        }) in ${interpreter.formatLocation()}`;
        debugMsg += "\r\nBacktrace: \r\n";
        BrsDevice.stdout.write(`print,${debugMsg}`);
        BrsDevice.stdout.write(`print,${interpreter.formatBacktrace(nextLoc)}`);
        BrsDevice.stdout.write(`print,Local variables:\r\n`);
        BrsDevice.stdout.write(`print,${interpreter.formatVariables()}`);
    }
}

/**
 * Function to wait for the next debug command
 * @returns a string with the debug expression
 */
function nextDebugCommand(interpreter: Interpreter): string {
    let line = "";
    BrsDevice.stdout.write(`print,\r\n${debugPrompt}`);
    Atomics.wait(BrsDevice.sharedArray, DataType.DBG, -1);
    const cmd = Atomics.load(BrsDevice.sharedArray, DataType.DBG);
    Atomics.store(BrsDevice.sharedArray, DataType.DBG, -1);
    if (cmd === DebugCommand.EXPR) {
        line = BrsDevice.readDataBuffer();
    }
    return line;
}

/**
 * Function to Handle a Debug Expression
 * @param interpreter (Interpreter) - The interpreter instance
 * @param expr (string) - The expression to evaluate
 */
async function debugHandleExpr(interpreter: Interpreter, expr: string) {
    const lexer = new Lexer();
    const parser = new Parser();
    interpreter.debugMode = false;
    if (expr.trim().length === 0) {
        return;
    }
    const exprScan = lexer.scan(`${expr}\n`, "debug");
    if (exprScan.errors.length > 0) {
        BrsDevice.stderr.write(`error,${exprScan.errors[0].message}\r\n`);
        return;
    }
    const exprParse = parser.parse(exprScan.tokens);
    if (exprParse.errors.length > 0) {
        BrsDevice.stderr.write(`error,${exprParse.errors[0].message}\r\n`);
        return;
    }
    if (exprParse.statements.length > 0) {
        runStatement(interpreter, exprParse.statements[0]);
    }
}

/**
 * Function to run a debug statement
 * @param interpreter (Interpreter) - The interpreter instance
 * @param exprStmt  (Statement) - The statement to run
 */
function runStatement(interpreter: Interpreter, exprStmt: Statement) {
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
        } else if (exprStmt instanceof If) {
            interpreter.visitIf(exprStmt);
        } else if (exprStmt instanceof For) {
            interpreter.visitFor(exprStmt);
        } else if (exprStmt instanceof ForEach) {
            interpreter.visitForEach(exprStmt);
        } else if (exprStmt instanceof While) {
            interpreter.visitWhile(exprStmt);
        } else if (exprStmt instanceof Function) {
            interpreter.visitNamedFunction(exprStmt);
        } else {
            BrsDevice.stderr.write(`warning,Debug command/expression not supported!\r\n`);
        }
    } catch (err: any) {
        let msg = err.message;
        if (err instanceof BrsError) {
            msg = err.format();
        }
        BrsDevice.stderr.write(`error,${msg}\r\n`);
    }
}

/**
 * Function to Handle a Debug Command
 * @param interpreter (Interpreter) - The interpreter instance
 * @param currLoc (Location) - The current location
 * @param lastLoc (Location) - The last location
 * @param cmd (number) - The debug command to execute
 */
function debugHandleCommand(interpreter: Interpreter, currLoc: Location, lastLoc: Location, cmd: number) {
    const backTrace = interpreter.stack;
    const lastLines = parseTextFile(interpreter.sourceMap.get(lastLoc.file));
    const currLines = parseTextFile(interpreter.sourceMap.get(currLoc.file));
    let lastLine: number = lastLoc.start.line;
    let currLine: number = currLoc.start.line;
    let lineText: string = "";
    let debugMsg: string = "";
    switch (cmd) {
        case DebugCommand.BT:
            debugMsg = `print,${interpreter.formatBacktrace(currLoc)}`;
            break;
        case DebugCommand.HELP:
            debugMsg = `print,${debugHelp()}`;
            break;
        case DebugCommand.LAST:
            lineText = lastLines[lastLine - 1].trimEnd();
            debugMsg = `print,${lastLine.toString().padStart(3, "0")}: ${lineText}\r\n`;
            break;
        case DebugCommand.LIST: {
            const flagLine = currLoc.file === lastLoc.file ? lastLine : currLine;
            debugMsg = `print,${debugList(backTrace, currLines, flagLine)}`;
            break;
        }
        case DebugCommand.NEXT:
            lineText = currLines[currLine - 1].trimEnd();
            debugMsg = `print,${currLine.toString().padStart(3, "0")}: ${lineText}\r\n`;
            break;
        case DebugCommand.THREAD:
            lineText = lastLines[lastLine - 1].trim();
            debugMsg = "print,Thread selected: ";
            debugMsg += ` 0*   ${interpreter.formatLocation(currLoc).padEnd(40)}${lineText}\r\n`;
            break;
        case DebugCommand.THREADS:
            lineText = lastLines[lastLine - 1].trim();
            debugMsg = "print,ID    Location                                Source Code\r\n";
            debugMsg += ` 0*   ${interpreter.formatLocation(currLoc).padEnd(40)}${lineText}\r\n`;
            debugMsg += "  *selected\r\n";
            break;
        case DebugCommand.BSCS: {
            const objList = Array.from(bscs.keys()).sort();
            let total = 0;
            debugMsg = "print,";
            for (const obj of objList) {
                const value = bscs.get(obj);
                if (value) {
                    debugMsg += `${obj}: `.padStart(27);
                    debugMsg += `count=${value}\r\n`;
                    total += value;
                }
            }
            debugMsg += `Total # components: `.padStart(27);
            debugMsg += `${total}\r\n`;
            break;
        }
        case DebugCommand.STATS:
            debugMsg = `print,${interpreter.formatStats()}`;
            break;
        case DebugCommand.CLASSES: {
            const classList = BrsObjects.keys().sort();
            debugMsg = `print,${classList.join("\r\n")}\r\n`;
            break;
        }
        case DebugCommand.VAR:
            debugMsg = `print,${interpreter.formatVariables()}`;
            break;
        case DebugCommand.BREAK:
            debugMsg = `warning,Micro Debugger already running!\r\n`;
            break;
        case DebugCommand.PAUSE:
            break;
        default:
            debugMsg = `warning,Invalid Debug command/expression!\r\n`;
            break;
    }
    if (debugMsg.length) {
        BrsDevice.stdout.write(debugMsg);
    }
}

/**
 * Function to list the current function
 * @param backTrace (TracePoint[]) - The backtrace of the current function
 * @param currLines (string[]) - The current lines of the function
 * @param flagLine  (number) - The line to flag
 * @returns (string) - The formatted list of the current function
 */
function debugList(backTrace: TracePoint[], currLines: string[], flagLine: number): string {
    let list = "";
    if (backTrace.length > 0) {
        const func = backTrace[backTrace.length - 1];
        const start = func.functionLocation.start.line;
        const end = Math.min(func.functionLocation.end.line, currLines.length);
        for (let index = start; index <= end; index++) {
            const flag = index === flagLine ? "*" : " ";
            const line = currLines[index - 1].trimEnd();
            list += `${index.toString().padStart(3, "0")}:${flag} ${line}\r\n`;
        }
    }
    return list;
}

/**
 * Function to list the Help message with the valid commands
 * @returns (string) - The help message
 */
function debugHelp(): string {
    let debugMsg = "";

    debugMsg += "Command List:\r\n";
    debugMsg += "   bt              Print backtrace of call function context frames\r\n";
    // debugMsg += "   brkd            Break on BrightScript diagnostics\r\n"
    debugMsg += "   classes         List public classes\r\n";
    debugMsg += "   cont|c          Continue script execution\r\n";
    // debugMsg += "   down|d          Move down the function context chain one\r\n"
    debugMsg += "   exit|quit|q     Exit shell\r\n";
    // debugMsg += "   gc              Run garbage collector\r\n"
    debugMsg += "   last|l          Show last line that executed\r\n";
    debugMsg += "   next|n          Show the next line to execute\r\n";
    debugMsg += "   list            List current function\r\n";
    // debugMsg += "   bsc             List BrightScript Component instances\r\n"
    debugMsg += "   bscs            Summarize BrightScript Component instances\r\n";
    debugMsg += "   stats           Shows statistics\r\n";
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
    return debugMsg;
}

/**
 * Function to parse a debug command
 * @param command (string) - The command to parse
 * @returns (any) - The parsed command
 */
function parseCommand(command: string): any {
    let result = { cmd: DebugCommand.EXPR, expr: "" };
    if (command?.length) {
        const commandsMap = new Map([
            ["bscs", DebugCommand.BSCS],
            ["bt", DebugCommand.BT],
            ["classes", DebugCommand.CLASSES],
            ["cont", DebugCommand.CONT],
            ["c", DebugCommand.CONT],
            ["exit", DebugCommand.EXIT],
            ["q", DebugCommand.EXIT],
            ["quit", DebugCommand.EXIT],
            ["help", DebugCommand.HELP],
            ["last", DebugCommand.LAST],
            ["l", DebugCommand.LAST],
            ["list", DebugCommand.LIST],
            ["next", DebugCommand.NEXT],
            ["n", DebugCommand.NEXT],
            ["over", DebugCommand.STEP],
            ["out", DebugCommand.STEP],
            ["step", DebugCommand.STEP],
            ["stats", DebugCommand.STATS],
            ["s", DebugCommand.STEP],
            ["t", DebugCommand.STEP],
            ["thread", DebugCommand.THREAD],
            ["th", DebugCommand.THREAD],
            ["threads", DebugCommand.THREADS],
            ["ths", DebugCommand.THREADS],
            ["var", DebugCommand.VAR],
            ["break", DebugCommand.BREAK],
            ["pause", DebugCommand.PAUSE],
        ]);
        let exprs = command.trim().split(/(?<=^\S+)\s/);
        let cmd = commandsMap.get(exprs[0].toLowerCase());
        if (cmd !== undefined && exprs.length === 1) {
            result.cmd = cmd;
        } else {
            let expr = command.toString().trim();
            if (exprs[0].toLowerCase() === "p") {
                expr = "? " + expr.slice(1);
            }
            result.expr = expr;
        }
    }
    return result;
}
