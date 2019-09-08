import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { RoArray } from "./RoArray";
import { RoFont } from "./RoFont";
import { RoString } from "./RoString";

export class RoFontRegistry extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly defaultFontFamily = "Arial, Helvetica, sans-serif";
    readonly defaultFontSize = 40;
    private fontRegistry: BrsString[];

    constructor() {
        super("roFontRegistry");
        this.registerMethods([
            this.register,
            this.getFamilies,
            this.getFont,
            this.getDefaultFont,
            this.getDefaultFontSize,
            // this.get, ---> Deprecated as only needed to roImageCanvas
        ]);
        this.fontRegistry = [];
    }

    toString(parent?: BrsType): string {
        return "<Component: roFontRegistry>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Register a font file (.ttf or .otf format). */
    private register = new Callable("register", {
        signature: {
            args: [new StdlibArgument("fontPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, fontPath: BrsString) => {
            this.fontRegistry.push(fontPath); // TODO: Get and register font family name with path
            return BrsBoolean.True;
        },
    });

    /** Returns an roArray of strings that represent the names of the font families which have been registered via Register(). */
    private getFamilies = new Callable("getFamilies", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.fontRegistry);
        },
    });

    /**  */
    private getFont = new Callable("getFont", {
        signature: {
            args: [
                new StdlibArgument("family", ValueKind.String),
                new StdlibArgument("size", ValueKind.Int32),
                new StdlibArgument("bold", ValueKind.Boolean),
                new StdlibArgument("italic", ValueKind.Boolean),
            ],
            returns: ValueKind.Object,
        },
        impl: (
            _: Interpreter,
            family: BrsString,
            size: Int32,
            bold: BrsBoolean,
            italic: BrsBoolean
        ) => {
            return new RoFont(family, size, bold, italic);
        },
    });

    /** Returns an roFont object representing the system font */
    private getDefaultFont = new Callable("getDefaultFont", {
        signature: {
            args: [
                new StdlibArgument("size", ValueKind.Int32, new Int32(this.defaultFontSize)),
                new StdlibArgument("bold", ValueKind.Boolean, BrsBoolean.False),
                new StdlibArgument("italic", ValueKind.Boolean, BrsBoolean.False),
            ],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, size: Int32, bold: BrsBoolean, italic: BrsBoolean) => {
            let family = new BrsString(this.defaultFontFamily);
            return new RoFont(family, size, bold, italic);
        },
    });

    /** Returns the default font size */
    private getDefaultFontSize = new Callable("getDefaultFontSize", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.defaultFontSize);
        },
    });
}
