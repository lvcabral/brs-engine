import { BrsValue, ValueKind, BrsString, BrsBoolean, BrsInvalid, Comparable } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoAssociativeArray, AAMember, isStringComp } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import path from "path";

export class RoPath extends BrsComponent implements BrsValue, Comparable {
    readonly kind = ValueKind.Object;
    private fullPath: string = "";
    private parsedPath: any;
    private parsedUrl: URL;
    private valid: boolean = false;

    constructor(pathName: BrsString) {
        super("roPath");
        this.parsedUrl = this.setPath(pathName.value);
        this.registerMethods({
            ifPath: [this.change, this.isValid, this.split],
            ifString: [this.setString, this.getString],
        });
    }

    setPath(pathName: string) {
        pathName = pathName.replace(/[/\\]+/g, path.posix.sep);
        let newUrl: URL;
        if (canParseURL(pathName)) {
            newUrl = new URL(pathName);
            this.fullPath = pathName;
            this.parsedPath = path.parse(`${newUrl.host}${newUrl.pathname}`);
            this.valid = true;
        } else {
            newUrl = new URL("tmp:/blank");
            this.fullPath = "";
            this.valid = false;
        }
        return newUrl;
    }
    getParentPart(): string {
        if (typeof this.parsedPath?.base !== "string") {
            return this.fullPath;
        }
        const index = this.fullPath.indexOf(this.parsedPath.base);
        if (index === -1) {
            return this.fullPath;
        }
        return this.fullPath.slice(0, index);
    }

    toString(parent?: BrsType): string {
        return this.fullPath;
    }

    getValue() {
        return this.fullPath;
    }

    lessThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() < other.getValue());
        }
        return BrsBoolean.False;
    }

    greaterThan(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() > other.getValue());
        }
        return BrsBoolean.False;
    }

    equalTo(other: BrsType): BrsBoolean {
        if (isStringComp(other)) {
            return BrsBoolean.from(this.getValue() === other.getValue());
        }
        return BrsBoolean.False;
    }

    concat(other: BrsType): BrsString {
        if (isStringComp(other)) {
            return new BrsString(this.getValue() + other.getValue());
        }
        return new BrsString(this.getValue() + other.toString());
    }

    /** Modifies or changes the current path via the relative or absolute path passed as a string. */
    private change = new Callable("change", {
        signature: {
            args: [new StdlibArgument("newPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, newPath: BrsString) => {
            this.setPath(newPath.value);
            return BrsBoolean.from(this.valid);
        },
    });

    /** Checks whether the current path is valid; that is, if the path is correctly formed. */
    private isValid = new Callable("isValid", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.valid);
        },
    });

    /** Returns an roAssociativeArrays containing the significant elements of the path */
    private split = new Callable("split", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            if (this.fullPath === "") {
                return new RoAssociativeArray([]);
            }
            const parts = new Array<AAMember>();
            parts.push({
                name: new BrsString("basename"),
                value: new BrsString(this.parsedPath.name),
            });
            parts.push({
                name: new BrsString("extension"),
                value: new BrsString(this.parsedPath.ext),
            });
            parts.push({
                name: new BrsString("filename"),
                value: new BrsString(this.parsedPath.base),
            });
            parts.push({
                name: new BrsString("parent"),
                value: new BrsString(this.getParentPart()),
            });
            parts.push({
                name: new BrsString("phy"),
                value: new BrsString(this.parsedUrl.protocol),
            });
            return new RoAssociativeArray(parts);
        },
    });

    /** Sets the path string . */
    private setString = new Callable("SetString", {
        signature: {
            args: [new StdlibArgument("path", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_interpreter, path: BrsString) => {
            this.parsedUrl = this.setPath(path.value);
            return BrsInvalid.Instance;
        },
    });

    /** returns string with full path */
    private getString = new Callable("GetString", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_interpreter) => {
            return new BrsString(this.fullPath);
        },
    });
}

function canParseURL(string: string) {
    try {
        new URL(string);
        return true;
    } catch (err) {
        return false;
    }
}
