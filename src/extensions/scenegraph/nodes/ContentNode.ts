import {
    Interpreter,
    Int32,
    Callable,
    StdlibArgument,
    RoArray,
    BrsType,
    ValueKind,
    BrsString,
    BrsBoolean,
    BrsInvalid,
} from "brs-engine";
import { Node } from "./Node";
import type { Field } from "./Field";
import { FieldKind, FieldModel } from "../SGTypes";
import { SGNodeType } from ".";
import { toAssociativeArray } from "../factory/Serializer";

export class ContentNode extends Node {
    readonly defaultFields: FieldModel[] = [
        { name: "actors", type: "stringarray", hidden: true },
        { name: "actor", type: "string", hidden: true },
        { name: "adaptiveMaxStartBitrate", type: "integer", hidden: true },
        { name: "adaptiveMinStartBitrate", type: "integer", hidden: true },
        { name: "album", type: "string", hidden: true },
        { name: "appData", type: "string", value: "", hidden: true },
        { name: "artist", type: "string", hidden: true },
        { name: "audioFormat", type: "string", hidden: true },
        { name: "audioLanguageSelected", type: "string", hidden: true },
        { name: "audioPIDPref", type: "integer", hidden: true },
        { name: "bookmarkPosition", type: "integer", hidden: true },
        { name: "categories", type: "stringarray", hidden: true },
        { name: "category", type: "string", hidden: true },
        { name: "cdnConfig", type: "array", hidden: true },
        { name: "clipEnd", type: "float", hidden: true },
        { name: "clipStart", type: "float", hidden: true },
        { name: "closedCaptions", type: "boolean", hidden: true },
        { name: "color", type: "string", hidden: true },
        { name: "compositionMode", type: "string", hidden: true },
        { name: "contentType", type: "string", hidden: true },
        { name: "description", type: "string", hidden: true },
        { name: "directors", type: "stringarray", hidden: true },
        { name: "director", type: "string", hidden: true },
        { name: "encodingKey", type: "string", hidden: true },
        { name: "encodingType", type: "string", hidden: true },
        { name: "episodeNumber", type: "string", hidden: true },
        { name: "fhdBifUrl", type: "string", hidden: true },
        { name: "fhdPosterUrl", type: "string", hidden: true },
        { name: "filterCodecProfiles", type: "boolean", hidden: true },
        { name: "forwardQueryStringParams", type: "boolean", hidden: true },
        { name: "frameRate", type: "integer", hidden: true },
        { name: "fullHD", type: "boolean", hidden: true },
        { name: "hdBackgroundImageUrl", type: "string", hidden: true },
        { name: "hdBifUrl", type: "string", hidden: true },
        { name: "hdBranded", type: "boolean", hidden: true },
        { name: "hdGridPosterUrl", type: "string", hidden: true },
        { name: "hdListItemIconSelectedUrl", type: "string", hidden: true },
        { name: "hdListItemIconUrl", type: "string", hidden: true },
        { name: "hdPosterUrl", type: "string", hidden: true },
        { name: "hideIcon", type: "boolean", hidden: true },
        { name: "httpCertificatesFile", type: "string", hidden: true },
        { name: "httpCookies", type: "stringarray", hidden: true },
        { name: "httpHeaders", type: "stringarray", hidden: true },
        { name: "httpSendClientCertificate", type: "boolean", hidden: true },
        { name: "ignoreStreamErrors", type: "boolean", hidden: true },
        { name: "isHD", type: "boolean", hidden: true },
        { name: "keySystem", type: "string", value: "", hidden: true },
        { name: "length", type: "integer", hidden: true },
        { name: "licenseRenewURL", type: "string", value: "", hidden: true },
        { name: "licenseServerURL", type: "string", value: "", hidden: true },
        { name: "live", type: "boolean", hidden: true },
        { name: "liveBoundsPauseBehavior", type: "string", hidden: true },
        { name: "maxBandwidth", type: "integer", hidden: true },
        { name: "minBandwidth", type: "integer", hidden: true },
        { name: "numEpisodes", type: "integer", hidden: true },
        { name: "playDuration", type: "integer", hidden: true },
        { name: "playStart", type: "integer", hidden: true },
        { name: "preferredAudioCodec", type: "string", hidden: true },
        { name: "rating", type: "string", hidden: true },
        { name: "releaseDate", type: "string", hidden: true },
        { name: "sdBackgroundImageUrl", type: "string", hidden: true },
        { name: "sdBifUrl", type: "string", hidden: true },
        { name: "sdGridPosterUrl", type: "string", hidden: true },
        { name: "sdListItemIconSelectedUrl", type: "string", hidden: true },
        { name: "sdListItemIconUrl", type: "string", hidden: true },
        { name: "sdPosterUrl", type: "string", hidden: true },
        { name: "serializationURL", type: "string", value: "", hidden: true },
        { name: "serviceCert", type: "string", value: "", hidden: true },
        { name: "shortDescriptionLine1", type: "string", hidden: true },
        { name: "shortDescriptionLine2", type: "string", hidden: true },
        { name: "sourceRect", type: "assocarray", hidden: true },
        { name: "starRating", type: "integer", hidden: true },
        { name: "stream", type: "assocarray", hidden: true },
        { name: "streamBitrates", type: "intarray", hidden: true },
        { name: "streamContentIDs", type: "stringarray", hidden: true },
        { name: "streamFormat", type: "string", hidden: true },
        { name: "streamQualities", type: "stringarray", hidden: true },
        { name: "streams", type: "assocarray", hidden: true },
        { name: "streamStartTimeOffset", type: "integer", hidden: true },
        { name: "streamStickyHttpRedirects", type: "boolarray", hidden: true },
        { name: "streamUrls", type: "stringarray", hidden: true },
        { name: "subtitleColor", type: "string", hidden: true },
        { name: "subtitleConfig", type: "assocarray", hidden: true },
        { name: "subtitleTracks", type: "assocarray", hidden: true },
        { name: "subtitleUrl", type: "string", hidden: true },
        { name: "switchingStrategy", type: "string", hidden: true },
        { name: "targetRect", type: "assocarray", hidden: true },
        { name: "targetRotation", type: "float", hidden: true },
        { name: "targetTranslation", type: "assocarray", hidden: true },
        { name: "text", type: "string", hidden: true },
        { name: "textAttrs", type: "assocarray", hidden: true },
        { name: "textOverlayBody", type: "string", hidden: true },
        { name: "textOverlayUL", type: "string", hidden: true },
        { name: "textOverlayUR", type: "string", hidden: true },
        { name: "title", type: "string", hidden: true },
        { name: "titleSeason", type: "string", hidden: true },
        { name: "trackIDAudio", type: "string", hidden: true },
        { name: "trackIDSubtitle", type: "string", hidden: true },
        { name: "trackIDVideo", type: "string", hidden: true },
        { name: "url", type: "string", hidden: true },
        { name: "userStarRating", type: "integer", hidden: true },
        { name: "videoDisableUI", type: "boolean", hidden: true },
        { name: "watched", type: "boolean", hidden: true },
    ];

    /**
     * This creates an easy way to track whether a field is a metadata field or not.
     * The reason to keep track is because metadata fields should print out in all caps.
     */
    private readonly parentFields = new Set<Field>();

    constructor(readonly name: string = SGNodeType.ContentNode) {
        super([], name);
        this.setExtendsType(name, SGNodeType.Node);

        this.registerDefaultFields(this.defaultFields);
        this.overrideMethods([this.count, this.keys, this.items, this.hasField]);
    }

    private getVisibleFields() {
        let fields = this.getNodeFields();
        return Array.from(fields).filter(([key, value]) => !value.isHidden());
    }

    /** @override */
    setValue(index: string, value: BrsType, alwaysNotify?: boolean, kind?: FieldKind, sync?: boolean) {
        this.notified = false;
        super.setValue(index, value, alwaysNotify, kind, sync);
        // Propagate changes notification to parent fields
        if (this.parentFields.size && this.notified) {
            for (const field of this.parentFields) {
                field.notifyObservers();
            }
        }
    }

    /** @override */
    appendChildToParent(child: BrsType): boolean {
        let success = false;
        let added = false;
        let appendedIndex: number | null = null;
        if (child instanceof ContentNode) {
            success = true;
            if (!this.children.includes(child)) {
                appendedIndex = this.children.length;
                this.children.push(child);
                child.setNodeParent(this);
                added = true;
            }
        } else if (child instanceof Node || child === BrsInvalid.Instance) {
            success = true;
            appendedIndex = this.children.length;
            this.children.push(BrsInvalid.Instance);
            added = true;
        }
        this.changed ||= success;
        if (added && appendedIndex !== null) {
            this.makeDirty();
            this.recordChildChange("add", appendedIndex);
            // Propagate changes notification to parent fields
            if (this.parentFields.size) {
                for (const field of this.parentFields) {
                    field.notifyObservers();
                }
            }
        }
        return success;
    }

    addParentField(parentField: Field) {
        this.parentFields.add(parentField);
    }

    removeParentField(parentField: Field) {
        this.parentFields.delete(parentField);
    }

    replaceField(fieldName: string, type: string, defaultValue?: BrsType, alwaysNotify: boolean = false) {
        if (this.fields.has(fieldName.toLowerCase())) {
            this.fields.delete(fieldName.toLowerCase());
            this.addNodeField(fieldName, type, alwaysNotify, false);
            // set default value if it was specified in xml
            if (defaultValue) {
                this.setValueSilent(fieldName, defaultValue);
            }
        }
    }

    /** @override */
    getElements() {
        return this.getVisibleFields()
            .map(([key, value]) => key)
            .sort()
            .map((key) => new BrsString(key));
    }

    /** @override */
    getValues() {
        return this.getVisibleFields()
            .map(([key, value]) => value)
            .sort()
            .map((field: Field) => field.getValue());
    }

    /**
     * @override
     * Returns the number of visible fields in the node.
     */
    protected count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "count");
            if (remote !== undefined) {
                return remote;
            }
            return new Int32(this.getVisibleFields().length);
        },
    });

    /**
     * @override
     * Returns an array of visible keys from the node in lexicographical order.
     */
    protected keys = new Callable("keys", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "keys");
            if (remote !== undefined) {
                return remote;
            }
            return new RoArray(this.getElements());
        },
    });

    /**
     * @override
     * Returns an array of visible values from the node in lexicographical order.
     */
    protected items = new Callable("items", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter) => {
            const remote = this.rendezvousCall(interpreter, "items");
            if (remote !== undefined) {
                return remote;
            }
            return new RoArray(
                this.getElements().map((key: BrsString) => {
                    return toAssociativeArray({ key: key, value: this.get(key) });
                })
            );
        },
    });

    /**
     * @override
     * Returns true if the field exists. Marks the field as not hidden.
     */
    protected hasField = new Callable("hasField", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString) => {
            const remote = this.rendezvousCall(interpreter, "hasField", [fieldname]);
            if (remote !== undefined) {
                return remote;
            }
            let field = this.getNodeFields().get(fieldname.value.toLowerCase());
            if (field) {
                field.setHidden(false);
                return BrsBoolean.True;
            } else {
                return BrsBoolean.False;
            }
        },
    });
}
