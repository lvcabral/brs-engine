import { FieldModel, Field, RoSGNode } from "../components/RoSGNode";
import { BrsType, toAssociativeArray } from "..";
import { ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { Callable, StdlibArgument } from "../Callable";
import { RoArray } from "../components/RoArray";

export class ContentNode extends RoSGNode {
    readonly defaultFields: FieldModel[] = [
        { name: "ContentType", type: "string", hidden: true },
        { name: "Title", type: "string", hidden: true },
        { name: "TitleSeason", type: "string", hidden: true },
        { name: "Description", type: "string", hidden: true },
        { name: "SDPosterUrl", type: "string", hidden: true },
        { name: "HDPosterUrl", type: "string", hidden: true },
        { name: "FHDPosterUrl", type: "string", hidden: true },
        { name: "ReleaseDate", type: "string", hidden: true },
        { name: "Rating", type: "string", hidden: true },
        { name: "StarRating", type: "integer", hidden: true },
        { name: "UserStarRating", type: "integer", hidden: true },
        { name: "ShortDescriptionLine1", type: "string", hidden: true },
        { name: "ShortDescriptionLine2", type: "string", hidden: true },
        { name: "EpisodeNumber", type: "string", hidden: true },
        { name: "NumEpisodes", type: "integer", hidden: true },
        { name: "Actors", type: "array", hidden: true },
        { name: "Actors", type: "string", hidden: true },
        { name: "Directors", type: "array", hidden: true },
        { name: "Director", type: "string", hidden: true },
        { name: "Categories", type: "array", hidden: true },
        { name: "Categories", type: "string", hidden: true },
        { name: "Album", type: "string", hidden: true },
        { name: "Artist", type: "string", hidden: true },
        { name: "TextOverlayUL", type: "string", hidden: true },
        { name: "TextOverlayUR", type: "string", hidden: true },
        { name: "TextOverlayBody", type: "string", hidden: true },
        { name: "appData", type: "string", value: "", hidden: true },
        { name: "encodingKey", type: "string", value: "", hidden: true },
        { name: "encodingType", type: "string", value: "", hidden: true },
        { name: "KeySystem", type: "string", value: "", hidden: true },
        { name: "licenseRenewURL", type: "string", value: "", hidden: true },
        { name: "licenseServerURL", type: "string", value: "", hidden: true },
        { name: "serializationURL", type: "string", value: "", hidden: true },
        { name: "serviceCert", type: "string", value: "", hidden: true },
        { name: "Live", type: "boolean", hidden: true },
        { name: "Url", type: "string", hidden: true },
        { name: "SDBifUrl", type: "string", hidden: true },
        { name: "HDBifUrl", type: "string", hidden: true },
        { name: "FHDBifUrl", type: "string", hidden: true },
        { name: "Stream", type: "assocarray", hidden: true },
        { name: "Streams", type: "assocarray", hidden: true },
        { name: "StreamBitrates", type: "array", hidden: true },
        { name: "StreamUrls", type: "array", hidden: true },
        { name: "StreamQualities", type: "array", hidden: true },
        { name: "StreamContentIDs", type: "array", hidden: true },
        { name: "StreamStickyHttpRedirects", type: "array", hidden: true },
        { name: "StreamStartTimeOffset", type: "integer", hidden: true },
        { name: "StreamFormat", type: "string", hidden: true },
        { name: "Length", type: "integer", hidden: true },
        { name: "BookmarkPosition", type: "integer", hidden: true },
        { name: "PlayStart", type: "integer", hidden: true },
        { name: "PlayDuration", type: "integer", hidden: true },
        { name: "ClosedCaptions", type: "boolean", hidden: true },
        { name: "HDBranded", type: "boolean", hidden: true },
        { name: "IsHD", type: "boolean", hidden: true },
        { name: "SubtitleColor", type: "string", hidden: true },
        { name: "SubtitleConfig", type: "assocarray", hidden: true },
        { name: "SubtitleTracks", type: "assocarray", hidden: true },
        { name: "SubtitleUrl", type: "string", hidden: true },
        { name: "VideoDisableUI", type: "boolean", hidden: true },
        { name: "EncodingType", type: "string", hidden: true },
        { name: "EncodingKey", type: "string", hidden: true },
        { name: "SwitchingStrategy", type: "string", hidden: true },
        { name: "Watched", type: "boolean", hidden: true },
        { name: "ForwardQueryStringParams", type: "boolean", hidden: true },
        { name: "IgnoreStreamErrors", type: "boolean", hidden: true },
        { name: "AdaptiveMinStartBitrate", type: "integer", hidden: true },
        { name: "AdaptiveMaxStartBitrate", type: "integer", hidden: true },
        { name: "filterCodecProfiles", type: "boolean", hidden: true },
        { name: "LiveBoundsPauseBehavior", type: "string", hidden: true },
        { name: "ClipStart", type: "float", hidden: true },
        { name: "ClipEnd", type: "float", hidden: true },
        { name: "preferredaudiocodec", type: "string", hidden: true },
        { name: "CdnConfig", type: "array", hidden: true },
        { name: "HttpCertificatesFile", type: "string", hidden: true },
        { name: "HttpCookies", type: "array", hidden: true },
        { name: "HttpHeaders", type: "array", hidden: true },
        { name: "HttpSendClientCertificate", type: "boolean", hidden: true },
        { name: "MinBandwidth", type: "integer", hidden: true },
        { name: "MaxBandwidth", type: "integer", hidden: true },
        { name: "AudioPIDPref", type: "integer", hidden: true },
        { name: "FullHD", type: "boolean", hidden: true },
        { name: "FrameRate", type: "integer", hidden: true },
        { name: "TrackIDAudio", type: "string", hidden: true },
        { name: "TrackIDVideo", type: "string", hidden: true },
        { name: "TrackIDSubtitle", type: "string", hidden: true },
        { name: "AudioFormat", type: "string", hidden: true },
        { name: "AudioLanguageSelected", type: "string", hidden: true },
        { name: "SDBackgroundImageUrl", type: "string", hidden: true },
        { name: "HDBackgroundImageUrl", type: "string", hidden: true },
        { name: "SourceRect", type: "assocarray", hidden: true },
        { name: "TargetRect", type: "assocarray", hidden: true },
        { name: "TargetTranslation", type: "assocarray", hidden: true },
        { name: "TargetRotation", type: "float", hidden: true },
        { name: "CompositionMode", type: "string", hidden: true },
        { name: "Text", type: "string", hidden: true },
        { name: "TextAttrs", type: "assocarray", hidden: true },
    ];

    /**
     * This creates an easy way to track whether a field is a metadata field or not.
     * The reason to keep track is because metadata fields should print out in all caps.
     */
    private metaDataFields = new Set<string>(
        this.defaultFields.map((field) => field.name.toLowerCase())
    );

    constructor(readonly name: string = "ContentNode") {
        super([], name);

        this.registerDefaultFields(this.defaultFields);
        this.registerMethods({
            ifAssociativeArray: [this.count, this.keys, this.items],
            ifSGNodeField: [this.hasfield],
        });
    }

    private getVisibleFields() {
        let fields = this.getFields();
        return Array.from(fields).filter(([key, value]) => !value.isHidden());
    }

    /** @override */
    toString(parent?: BrsType): string {
        let componentName = "roSGNode:" + this.nodeSubtype;

        if (parent) {
            return `<Component: ${componentName}>`;
        }

        let fields = this.getVisibleFields();
        return [
            `<Component: ${componentName}> =`,
            "{",
            ...fields.map(([key, value]) => {
                // If it's a meta-data field, it should print out in all caps.
                key = this.metaDataFields.has(key.toLowerCase()) ? key.toUpperCase() : key;
                return `    ${key}: ${value.toString(this)}`;
            }),
            "}",
        ].join("\n");
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
    protected hasfield = new Callable("hasfield", {
        signature: {
            args: [new StdlibArgument("fieldname", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, fieldname: BrsString) => {
            let field = this.getFields().get(fieldname.value.toLowerCase());
            if (field) {
                field.setHidden(false);
                return BrsBoolean.True;
            } else {
                return BrsBoolean.False;
            }
        },
    });
}
