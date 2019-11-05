import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoMessagePort } from "./RoMessagePort";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import * as PNG from "fast-png";

export class RoURLTransfer extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private identity: number;
    private url: string;
    private reqMethod: string;
    private port?: RoMessagePort;

    // Constructor can only be used by RoFontRegistry()
    constructor() {
        super("roUrlTransfer", [
            "ifUrlTransfer",
            "ifHttpAgent",
            "ifSetMessagePort",
            "ifGetMessagePort",
        ]);
        this.identity = Math.trunc(Math.random() * 10 * 8);
        this.url = "";
        this.reqMethod = "";
        this.registerMethods([
            this.getIdentity,
            this.setUrl,
            this.getUrl,
            this.setRequest,
            this.getRequest,
            //this.getToString,
            this.getToFile,
            // this.asyncGetToString,
            // this.asyncGetToFile,
            // this.head,
            // this.asyncHead,
            // this.postFromString,
            // this.postFromFile,
            // this.asyncPostFromString,
            // this.asyncPostFromFile,
            // this.asyncPostFromFileToFile,
            // this.asyncCancel,
            // this.retainBodyOnError,
            // this.setUserAndPassword,
            // this.setMinimumTransferRate,
            // this.getFailureReason,
            // this.enableEncodings,
            // this.escape,
            // this.unescape,
            // this.urlEncode,
            // this.enableResume,
            // this.enablePeerVerification,
            // this.enableHostVerification,
            // this.enableFreshConnection,
            // this.setHttpVersion,
            // this.addHeader,
            // this.setHeaders,
            // this.initClientCertificates,
            // this.setCertificatesFile,
            // this.setCertificatesDepth,
            // this.enableCookies,
            // this.getCookies,
            // this.addCookies,
            // this.clearCookies,
            this.getMessagePort,
            this.getPort,
            this.setMessagePort,
            this.setPort,
        ]);
    }

    toString(parent?: BrsType): string {
        return "<Component: roUrlTransfer>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    // ifUrlTransfer ----------------------------------------------------------------------------------

    /** Returns a unique number for this object that can be used to identify whether events originated from this object. */
    private getIdentity = new Callable("getIdentity", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.identity);
        },
    });

    /** Sets the URL to use for the transfer request. */
    private setUrl = new Callable("setUrl", {
        signature: {
            args: [new StdlibArgument("url", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, url: BrsString) => {
            this.url = url.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current URL. */
    private getUrl = new Callable("getUrl", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.url);
        },
    });

    /** Changes the request method from the normal GET, HEAD or POST to the value passed as a string. */
    private setRequest = new Callable("setRequest", {
        signature: {
            args: [new StdlibArgument("reqMethod", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, reqMethod: BrsString) => {
            this.reqMethod = reqMethod.value;
            return BrsInvalid.Instance;
        },
    });

    /** Returns the current request method. */
    private getRequest = new Callable("getRequest", {
        signature: {
            args: [],
            returns: ValueKind.String,
        },
        impl: (_: Interpreter) => {
            return new BrsString(this.reqMethod);
        },
    });

    /** Connect to the remote URL and write the response body to a file on the filesystem. */
    private getToFile = new Callable("getToFile", {
        signature: {
            args: [new StdlibArgument("filePath", ValueKind.String)],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter, filePath: BrsString) => {
            const path = new URL(filePath.value);
            const volume = interpreter.fileSystem.get(path.protocol);
            const xhr = new XMLHttpRequest();
            try {
                const ext = path.pathname.split(".").pop();
                xhr.open("GET", this.url, false); // Note: synchronous
                if (ext === "png") {
                    xhr.responseType = "arraybuffer";
                }
                xhr.send();
                if (xhr.status === 200 && volume) {
                    if (ext === "png") {
                        let png = PNG.decode(xhr.response);
                        console.log("roUrlTransfer", png.width, png.height, png.channels);
                        volume.writeFileSync(path.pathname, xhr.response);
                    } else {
                        volume.writeFileSync(path.pathname, xhr.response);
                    }
                }
            } catch (e) {
                console.error(e);
                return new Int32(400); // Bad Request
            }
            return new Int32(xhr.status);
        },
    });

    // ifGetMessagePort ----------------------------------------------------------------------------------

    /** Returns the message port (if any) currently associated with the object */
    private getMessagePort = new Callable("getMessagePort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port || BrsInvalid.Instance;
        },
    });

    /** Returns the message port (if any) currently associated with the object */
    private getPort = new Callable("getPort", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.port || BrsInvalid.Instance;
        },
    });

    // ifSetMessagePort ----------------------------------------------------------------------------------

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setMessagePort = new Callable("setMessagePort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableUrlTransfer(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });

    /** Sets the roMessagePort to be used for all events from the audio player */
    private setPort = new Callable("setPort", {
        signature: {
            args: [new StdlibArgument("port", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, port: RoMessagePort) => {
            port.enableUrlTransfer(true);
            this.port = port;
            return BrsInvalid.Instance;
        },
    });
}
