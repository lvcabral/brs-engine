import { BrsValue, ValueKind, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType } from "..";
import { BrsHttpAgent, IfHttpAgent } from "../interfaces/IfHttpAgent";
import { DefaultCertificatesFile } from "../../common";

export class RoHttpAgent extends BrsComponent implements BrsValue, BrsHttpAgent {
    readonly kind = ValueKind.Object;
    readonly ifHttpAgent: IfHttpAgent;
    readonly customHeaders: Map<string, string>;
    cookiesEnabled: boolean;
    certificatesFile: string;

    constructor() {
        super("roHttpAgent");
        this.cookiesEnabled = false;
        this.certificatesFile = DefaultCertificatesFile;
        this.customHeaders = new Map<string, string>();
        this.ifHttpAgent = new IfHttpAgent(this);
        this.registerMethods({
            ifHttpAgent: [
                this.ifHttpAgent.addHeader,
                this.ifHttpAgent.setHeaders,
                this.ifHttpAgent.initClientCertificates,
                this.ifHttpAgent.setCertificatesFile,
                this.ifHttpAgent.setCertificatesDepth,
                this.ifHttpAgent.enableCookies,
                this.ifHttpAgent.getCookies,
                this.ifHttpAgent.addCookies,
                this.ifHttpAgent.clearCookies,
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
