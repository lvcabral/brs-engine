import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoLocalization extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private locale: string;

    // Constructor can only be used by RoFontRegistry()
    constructor(interpreter: Interpreter) {
        super("roLocalization", ["ifLocalization"]);
        this.locale = interpreter.deviceInfo.get("locale");
        this.registerMethods([this.getPluralString, this.getLocalizedAsset]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roLocalization>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Replaces "^n" in pluralString with count and returns the result. */
    private getPluralString = new Callable("getPluralString", {
        signature: {
            args: [
                new StdlibArgument("count", ValueKind.Int32),
                new StdlibArgument("zeroString", ValueKind.String),
                new StdlibArgument("oneString", ValueKind.String),
                new StdlibArgument("pluralString", ValueKind.String),
            ],
            returns: ValueKind.String,
        },
        impl: (
            _: Interpreter,
            count: Int32,
            zeroString: BrsString,
            oneString: BrsString,
            pluralString: BrsString
        ) => {
            let plural: string;
            switch (count.getValue()) {
                case 0:
                    plural = zeroString.value;
                    break;
                case 1:
                    plural = oneString.value;
                    break;
                default:
                    plural = pluralString.value.replace("^n", count.toString());
                    break;
            }
            return new BrsString(plural);
        },
    });

    /** Returns an appropriate asset path based on the user's currently selected language. */
    private getLocalizedAsset = new Callable("getLocalizedAsset", {
        signature: {
            args: [
                new StdlibArgument("dirName", ValueKind.String),
                new StdlibArgument("fileName", ValueKind.String),
            ],
            returns: ValueKind.String,
        },
        impl: (interpreter: Interpreter, dirName: BrsString, fileName: BrsString) => {
            const volume = interpreter.fileSystem.get("pkg:");
            let assetPath = "";
            if (volume) {
                try {
                    if (
                        volume.existsSync(
                            `/locale/${this.locale}/${dirName.value}/${fileName.value}`
                        )
                    ) {
                        assetPath = `pkg:/locale/${this.locale}/${dirName.value}/${fileName.value}`;
                    } else if (volume.existsSync(`/locale/default/${dirName}/${fileName}`)) {
                        assetPath = `pkg:/locale/default/${dirName.value}/${fileName.value}`;
                    } else if (
                        volume.existsSync(`/locale/en_US/${dirName.value}/${fileName.value}`)
                    ) {
                        assetPath = `pkg:/locale/en_US/${dirName.value}/${fileName.value}`;
                    }
                } catch (err) {
                    const badPath = `pkg:/locale/${this.locale}/${dirName.value}/${fileName.value}`;
                    postMessage(`warning,Invalid path: ${badPath} ${err.message}`);
                }
            }
            return new BrsString(assetPath);
        },
    });
}
