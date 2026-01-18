import { DebugMode, Interpreter, TracePoint } from ".";
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
import { DataType, DebugCommand, DebugPrompt, numberToHex, parseTextFile } from "../common";
/// #if !BROWSER
import readline from "readline-sync";
readline.setDefaultOptions({ prompt: DebugPrompt });
/// #endif

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
        line = nextDebugCommand();
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
                interpreter.debugMode = DebugMode.NONE;
                BrsDevice.notifyDebugEnded();
                return true;
            case DebugCommand.STEP:
                if (errMessage) {
                    BrsDevice.stdout.write("print,Can't continue");
                    continue;
                }
                interpreter.debugMode = DebugMode.STEP;
                return true;
            case DebugCommand.EXIT:
                interpreter.debugMode = DebugMode.EXIT;
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
    const lastLines = parseTextFile(interpreter.sourceMap.get(lastLoc.file)) ?? [""];
    let debugMsg = "BrightScript Micro Debugger.\r\n";
    let lastLine: number = lastLoc.start.line;
    if (interpreter.debugMode === DebugMode.STEP && !errMessage) {
        const line = lastLines[lastLine - 1]?.trimEnd() ?? "";
        BrsDevice.stdout.write(`print,${lastLine.toString().padStart(3, "0")}: ${line}\r\n`);
    } else {
        BrsDevice.notifyDebugStarted();
        debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

        debugMsg += "\r\nCurrent Function:\r\n";
        let start = Math.max(lastLine - 8, 1);
        let end = Math.min(lastLine + 5, lastLines.length);
        for (let index = start; index < end; index++) {
            const flag = index === lastLine ? "*" : " ";
            const line = lastLines[index - 1]?.trimEnd() ?? "";
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
        debugMsg = "\r\nThreads: \r\n";
        debugMsg += debugThreads(interpreter, nextLoc, lastLines, lastLine);
        BrsDevice.stdout.write(`print,${debugMsg}\r\n`);
    }
}

/**
 * Function to wait for the next debug command
 * @returns a string with the debug expression
 */
function nextDebugCommand(): string {
    let line = "";
    BrsDevice.stdout.write(`print,\r\n${DebugPrompt}`);
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
    interpreter.debugMode = DebugMode.NONE;
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
    for (const stmt of exprParse.statements) {
        runStatement(interpreter, stmt);
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
    const backTrace = interpreter.stackCopy;
    const lastLines = parseTextFile(interpreter.sourceMap.get(lastLoc.file)) ?? [""];
    const currLines = parseTextFile(interpreter.sourceMap.get(currLoc.file)) ?? [""];
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
            lineText = lastLines[lastLine - 1]?.trimEnd() ?? "";
            debugMsg = `print,${lastLine.toString().padStart(3, "0")}: ${lineText}\r\n`;
            break;
        case DebugCommand.LIST: {
            const flagLine = currLoc.file === lastLoc.file ? lastLine : currLine;
            debugMsg = `print,${debugList(backTrace, currLines, flagLine)}`;
            break;
        }
        case DebugCommand.NEXT:
            lineText = currLines[currLine - 1]?.trimEnd() ?? "";
            debugMsg = `print,${currLine.toString().padStart(3, "0")}: ${lineText}\r\n`;
            break;
        case DebugCommand.THREAD: {
            const locText = ellipsizeLeft(interpreter.formatLocation(currLoc), 36);
            const lineText = lastLines[lastLine - 1]?.trim() ?? "";
            debugMsg = "print,Thread selected: ";
            debugMsg += ` ${BrsDevice.threadId}*   ${locText.padEnd(40)}${lineText}\r\n`;
            break;
        }
        case DebugCommand.THREADS:
            debugMsg = `print,${debugThreads(interpreter, currLoc, lastLines, lastLine)}`;
            break;
        case DebugCommand.BSCS: {
            const objList = Array.from(BrsDevice.bscs.keys()).sort((a: string, b: string) => a.localeCompare(b));
            let total = 0;
            debugMsg = "print,";
            for (const obj of objList) {
                const value = BrsDevice.bscs.get(obj);
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
        case DebugCommand.SGNODES: {
            const nodeStats = BrsDevice.nodes;
            let total = 0;
            debugMsg = "print,";
            if (nodeStats.size > 0) {
                for (const { name, count } of nodeStats.values()) {
                    debugMsg += `${name}: `.padStart(27);
                    debugMsg += `count=${count}\r\n`;
                    total += count;
                }
            }
            debugMsg += `Total # SceneGraph nodes: `.padStart(27);
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
 * Function to list all threads of execution
 * @param interpreter (Interpreter) - The interpreter instance
 * @param currLoc (Location) - The current location
 * @param lastLines (string[]) - The last lines executed
 * @param lastLine (number) - The last line executed
 * @returns (string) - The formatted list of threads
 */
function debugThreads(interpreter: Interpreter, currLoc: Location, lastLines: string[], lastLine: number) {
    let debugMsg = "";
    const locText = ellipsizeLeft(interpreter.formatLocation(currLoc), 36);
    const lineText = lastLines[lastLine - 1]?.trimEnd() ?? "";
    debugMsg = "ID    Location                                Source Code\r\n";
    debugMsg += ` ${BrsDevice.threadId}*   ${locText.padEnd(40)}${lineText}\r\n`;
    debugMsg += "  *selected";
    return debugMsg;
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
    debugMsg += "   sgnodes         Summarize SceneGraph nodes\r\n";
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
            ["sgnodes", DebugCommand.SGNODES],
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

/**
 * Ellipsizes text on the left based on a specific length
 * @param text - The text to ellipsize
 * @param length - The maximum length (including ellipsis)
 * @returns The ellipsized text with "..." at the beginning if truncated
 */
export function ellipsizeLeft(text: string, length: number): string {
    const ellipsis = "...";
    if (text.length <= length) {
        return text;
    }
    if (length <= ellipsis.length) {
        return ellipsis.slice(0, length);
    }
    const keepLength = length - ellipsis.length;
    return ellipsis + text.slice(-keepLength);
}
