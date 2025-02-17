import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { BrsDevice } from "../../device/BrsDevice";

export class RoLocalization extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly locale: string;

    // Constructor can only be used by RoFontRegistry()
    constructor() {
        super("roLocalization");
        this.locale = BrsDevice.deviceInfo.get("locale");
        this.registerMethods({ ifLocalization: [this.getPluralString, this.getLocalizedAsset] });
    }

    toString(parent?: BrsType): string {
        return "<Component: roLocalization>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Replaces "^n" in pluralString with count and returns the result. */
    private readonly getPluralString = new Callable("getPluralString", {
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
    private readonly getLocalizedAsset = new Callable("getLocalizedAsset", {
        signature: {
            args: [
                new StdlibArgument("dirName", ValueKind.String),
                new StdlibArgument("fileName", ValueKind.String),
            ],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter, dirName: BrsString, fileName: BrsString) => {
            const fsys = BrsDevice.fileSystem;
            if (!fsys) {
                return new BrsString("");
            }
            const filePath = `${dirName.value}/${fileName.value}`;
            try {
                let assetPath = "";
                if (fsys.existsSync(`pkg:/locale/${this.locale}/${filePath}`)) {
                    assetPath = `pkg:/locale/${this.locale}/${filePath}`;
                } else if (fsys.existsSync(`pkg:/locale/default/${filePath}`)) {
                    assetPath = `pkg:/locale/default/${filePath}`;
                } else if (fsys.existsSync(`pkg:/locale/en_US/${filePath}`)) {
                    assetPath = `pkg:/locale/en_US/${filePath}`;
                }
                return new BrsString(assetPath);
            } catch (err: any) {
                const badPath = `pkg:/locale/${this.locale}/${filePath}`;
                BrsDevice.stderr.write(`error,Invalid path: ${badPath} ${err.message}`);
            }
            return new BrsString("");
        },
    });
}
