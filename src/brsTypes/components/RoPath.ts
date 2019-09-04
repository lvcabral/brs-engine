import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, RoAssociativeArray, AAMember } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import * as path from "path";
import pathParse from "path-parse";
import URL from "url-parse";

export class RoPath extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private fullPath: string;
    private parsedPath: any;
    private parsedUrl: URL;
    private valid: boolean;
    private check: RegExp;

    constructor(pathName: BrsString) {
        super("roPath");
        // TODO: Validate path
        this.parsedUrl = new URL(pathName.value);
        this.check = new RegExp(/^([a-zA-Z]:)?(\/[^<>:"/\/|?*]+)+\/?$/, "i");
        if (!this.check.test(this.parsedUrl.pathname)) {
            this.fullPath = "";
            this.valid = false;
        } else {
            this.fullPath = pathName.value;
            this.valid = true;
        }
        this.parsedPath = pathParse(this.parsedUrl.pathname);
        this.registerMethods([this.change, this.isValid, this.split]);
    }

    toString(parent?: BrsType): string {
        return this.fullPath;
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Modifies or changes the current path via the relative or absolute path passed as a string. */
    private change = new Callable("change", {
        signature: {
            args: [new StdlibArgument("newPath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, newPath: BrsString) => {
            let pathName = "";
            let newUrl = new URL(newPath.value);
            if (newUrl.protocol == "http:" && newPath.value.substr(0, 5) !== "http:") {
                // no protocol passed (parser used default)
                pathName = path.join(this.parsedPath.dir, this.parsedPath.base, newPath.value);
            } else {
                this.parsedUrl = newUrl;
                pathName = newUrl.pathname;
            }
            if (!this.check.test(pathName)) {
                this.fullPath = "";
                this.valid = false;
            } else {
                this.parsedPath = pathParse(pathName);
                this.fullPath = this.parsedUrl.protocol + pathName;
                this.valid = true;
            }
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
                value: new BrsString(this.parsedUrl.protocol + this.parsedPath.dir + "/"),
            });
            parts.push({
                name: new BrsString("phy"),
                value: new BrsString(this.parsedUrl.protocol),
            });
            return new RoAssociativeArray(parts);
        },
    });
}
