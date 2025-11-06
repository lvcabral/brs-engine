import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { DefaultCertificatesFile } from "../../common";

export class RoHttpAgent extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roHttpAgent");
        this.cookiesEnabled = false;
        this.certificatesFile = DefaultCertificatesFile;
        this.customHeaders = new Map<string, string>();
        const ifHttpAgent = new IfHttpAgent(this);
        this.registerMethods({
            ifHttpAgent: [
                ifHttpAgent.addHeader,
                ifHttpAgent.setHeaders,
                ifHttpAgent.initClientCertificates,
                ifHttpAgent.setCertificatesFile,
                ifHttpAgent.setCertificatesDepth,
                ifHttpAgent.enableCookies,
                ifHttpAgent.getCookies,
                ifHttpAgent.addCookies,
                ifHttpAgent.clearCookies,
            ],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roHttpAgent>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }
}
