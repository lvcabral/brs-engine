import { Callable, ValueKind, BrsString, Int32, StdlibArgument } from "../brsTypes";
import { Interpreter } from "../interpreter";

/**
 * Moves the cursor to the specified position on the current line. If the
 * provided position is greater than the current console width and the output
 * is a TTY, the resulting position is modulo'd by the current console width.
 * May be used several times in a `print` list.
 */
export const Tab = new Callable(
    "Tab",
    {
        signature: {
            args: [ new StdlibArgument("position", ValueKind.Int32) ],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, position: Int32) => {
            let target = position.getValue();
            if (target < 0 || target < interpreter.stdout.position()) {
                return new BrsString("");
            }

            // TODO: this probably won't handle text wrapping well, but I'm not
            // sure what the reference implementation does here yet
            return new BrsString(" ".repeat(target - interpreter.stdout.position()));
        }

    }
);

/**
 * Returns a number from 0 to the current console width, indicating the
 * position of the output cursor. Requires a "dummy argument" of any type, as
 * it's completely ignored.
 */
export const Pos = new Callable(
    "Pos",
    {
        signature: {
            // `pos` expects an argument and doesn't use it. The reference
            // implementation's documentation even says it must be provided but
            // isn't used: https://sdkdocs.roku.com/display/sdkdoc/Program+Statements#ProgramStatements-PRINTitemlist
            args: [ new StdlibArgument("dummy", ValueKind.Dynamic) ],
            returns: ValueKind.Int32
        },
        impl: (interpreter: Interpreter) => {
            return new Int32(interpreter.stdout.position());
        }
    }
);