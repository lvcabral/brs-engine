import { ValueKind, BrsInvalid, BrsBoolean, BrsString, Uninitialized, BrsValue, Comparable } from "./BrsType";
import { RoArray } from "./components/RoArray";
import { RoAssociativeArray } from "./components/RoAssociativeArray";
import { RoList } from "./components/RoList";
import { RoByteArray } from "./components/RoByteArray";
import { Int32 } from "./Int32";
import { Int64 } from "./Int64";
import { Float } from "./Float";
import { Double } from "./Double";
import { Callable, StdlibArgument } from "./Callable";
import { BrsComponent } from "./components/BrsComponent";
import { RoString } from "./components/RoString";
import { BrsInterface } from "./interfaces/BrsInterface";
import { RoXMLList } from "./components/RoXMLList";
import { RoXMLElement } from "./components/RoXMLElement";
import { RoPath } from "./components/RoPath";
import { RoInt } from "./components/RoInt";
import { RoFloat } from "./components/RoFloat";
import { RoDouble } from "./components/RoDouble";
import { RoLongInteger } from "./components/RoLongInteger";
import { RoBoolean } from "./components/RoBoolean";
import { RoURLEvent } from "./events/RoURLEvent";
import { RoUniversalControlEvent } from "./events/RoUniversalControlEvent";
import { RoSystemLogEvent } from "./events/RoSystemLogEvent";
import { RoInputEvent } from "./events/RoInputEvent";
import { RoAudioPlayerEvent } from "./events/RoAudioPlayerEvent";
import { RoVideoPlayerEvent } from "./events/RoVideoPlayerEvent";
import { RoTextureRequestEvent } from "./events/RoTextureRequestEvent";
import { RoChannelStoreEvent } from "./events/RoChannelStoreEvent";
import { RoDeviceInfoEvent } from "./events/RoDeviceInfoEvent";
import { RoCECStatusEvent } from "./events/RoCECStatusEvent";
import { RoHdmiStatusEvent } from "./events/RoHdmiStatusEvent";
import { RoSGNodeEvent } from "./events/RoSGNodeEvent";
import { RoSGScreenEvent } from "./events/RoSGScreenEvent";
import { isUnboxable } from "./Boxing";
import { RoSGNode } from "./components/RoSGNode";
import { Task } from "./nodes/Task";
import { getNodeType, SGNodeFactory } from "../scenegraph/SGNodeFactory";
import { BrsObjects } from "./components/BrsObjects";
import { ContentNode } from "./nodes/ContentNode";

// BrightScript Type exports
export * from "./BrsType";
export * from "./Int32";
export * from "./Int64";
export * from "./Float";
export * from "./Double";
export * from "./Boxing";
export * from "./Callable";
export * from "./Coercion";
export * from "./interfaces/BrsInterface";
export * from "./components/BrsComponent";
export * from "./components/RoArray";
export * from "./components/RoByteArray";
export * from "./components/RoEVPCipher";
export * from "./components/RoEVPDigest";
export * from "./components/RoHMAC";
export * from "./components/RoDeviceCrypto";
export * from "./components/RoList";
export * from "./components/RoAssociativeArray";
export * from "./components/RoDateTime";
export * from "./components/RoTimespan";
export * from "./components/BrsObjects";
export * from "./components/RoFunction";
export * from "./components/RoRegex";
export * from "./components/RoString";
export * from "./components/RoBitmap";
export * from "./components/RoRegion";
export * from "./components/RoScreen";
export * from "./components/RoSprite";
export * from "./components/RoCompositor";
export * from "./components/RoImageMetadata";
export * from "./components/RoMessagePort";
export * from "./components/RoFontRegistry";
export * from "./components/RoFont";
export * from "./components/RoXMLElement";
export * from "./components/RoXMLList";
export * from "./components/RoBoolean";
export * from "./components/RoDouble";
export * from "./components/RoFloat";
export * from "./components/RoInt";
export * from "./components/RoLongInteger";
export * from "./components/RoInvalid";
export * from "./components/RoAppInfo";
export * from "./components/RoAppManager";
export * from "./components/RoPath";
export * from "./components/RoURLTransfer";
export * from "./components/RoHttpAgent";
export * from "./components/RoAudioPlayer";
export * from "./components/RoAudioResource";
export * from "./components/RoAudioMetadata";
export * from "./components/RoVideoPlayer";
export * from "./components/RoInput";
export * from "./components/RoSystemLog";
export * from "./components/RoLocalization";
export * from "./components/RoRegistry";
export * from "./components/RoRegistrySection";
export * from "./components/RoDeviceInfo";
export * from "./components/RoRemoteInfo";
export * from "./components/RoAppMemoryMonitor";
export * from "./components/RoFileSystem";
export * from "./components/RoChannelStore";
export * from "./components/RoSocketAddress";
export * from "./components/RoTextureRequest";
export * from "./components/RoTextureManager";
export * from "./components/RoUtils";
export * from "./events/RoURLEvent";
export * from "./events/RoInputEvent";
export * from "./events/RoAudioPlayerEvent";
export * from "./events/RoVideoPlayerEvent";
export * from "./events/RoSystemLogEvent";
export * from "./events/RoDeviceInfoEvent";
export * from "./events/RoChannelStoreEvent";
export * from "./events/RoUniversalControlEvent";

// SceneGraph Type exports
export * from "../scenegraph/SGNodeFactory";
export * from "./SGRoot";
export * from "./components/RoSGNode";
export * from "./components/RoSGScreen";
export * from "./events/RoSGNodeEvent";
export * from "./events/RoSGScreenEvent";
export * from "./nodes/Group";
export * from "./nodes/Scene";
export * from "./nodes/Keyboard";
export * from "./nodes/MiniKeyboard";
export * from "./nodes/TextEditBox";
export * from "./nodes/LayoutGroup";
export * from "./nodes/Panel";
export * from "./nodes/Rectangle";
export * from "./nodes/Label";
export * from "./nodes/ScrollingLabel";
export * from "./nodes/Font";
export * from "./nodes/Poster";
export * from "./nodes/Dialog";
export * from "./nodes/KeyboardDialog";
export * from "./nodes/ArrayGrid";
export * from "./nodes/RowList";
export * from "./nodes/ZoomRowList";
export * from "./nodes/MarkupGrid";
export * from "./nodes/MarkupList";
export * from "./nodes/ContentNode";
export * from "./nodes/Overhang";
export * from "./nodes/Task";
export * from "./nodes/Timer";
export * from "./nodes/Audio";
export * from "./nodes/SoundEffect";
export * from "./nodes/Video";
export * from "./nodes/LabelList";
export * from "./nodes/CheckList";
export * from "./nodes/RadioButtonList";
export * from "./nodes/Button";
export * from "./nodes/ButtonGroup";
export * from "./nodes/StandardDialog";
export * from "./nodes/StandardProgressDialog";
export * from "./nodes/StdDlgContentArea";
export * from "./nodes/StdDlgTitleArea";
export * from "./nodes/StdDlgProgressItem";
export * from "./nodes/BusySpinner";
export * from "./nodes/RSGPalette";
export * from "./nodes/ChannelStore";
export * from "./nodes/TrickPlayBar";

/**
 * Determines whether or not the given value is a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a numeric value, otherwise `false`.
 */
export function isBrsNumber(value: BrsType): value is BrsNumber {
    return value instanceof Int32 || value instanceof Int64 || value instanceof Float || value instanceof Double;
}

export const NumberKinds = new Set([ValueKind.Int32, ValueKind.Float, ValueKind.Double, ValueKind.Int64]);

export function isNumberKind(kind: ValueKind): boolean {
    return NumberKinds.has(kind);
}

export const PrimitiveKinds = new Set([
    ValueKind.Uninitialized,
    ValueKind.Invalid,
    ValueKind.Boolean,
    ...NumberKinds,
    ValueKind.String,
    ValueKind.Callable,
]);

/**
 * Determines whether or not the given value is a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a string, otherwise `false`.
 */
export function isBrsString(value: BrsType): value is BrsString | RoString {
    return value?.kind === ValueKind.String || value instanceof RoString;
}

/**
 * Determines whether or not the given value is a boolean.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` if a boolean, otherwise `false`.
 */
export function isBrsBoolean(value: BrsType): value is BrsBoolean | RoBoolean {
    return value?.kind === ValueKind.Boolean || value instanceof RoBoolean;
}

/**
 * Determines whether or not the given value is a BrightScript callable.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a Callable value, otherwise `false`.
 */
export function isBrsCallable(value: BrsType): value is Callable {
    return value?.kind === ValueKind.Callable;
}

/**
 * Determines whether or not the provided value is an instance of a iterable BrightScript type.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be iterated across, otherwise `false`.
 */
export function isIterable(value: BrsType): value is Iterable {
    return (
        "get" in value &&
        "getElements" in value &&
        "set" in value &&
        "hasNext" in value &&
        "getNext" in value &&
        "resetNext" in value
    );
}

/**
 * Determines whether or not the given value can be compared as a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be compared as a number, otherwise `false`.
 */
export function isNumberComp(value: BrsType): value is BrsType & Comparable {
    return isBrsNumber(value) || isBoxedNumber(value) || value instanceof RoUniversalControlEvent;
}

/**
 * Determines whether or not the given value can be compared as a string.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be compared as a string, otherwise `false`.
 */
export function isStringComp(value: BrsType): value is BrsString & Comparable {
    return isBrsString(value) || value instanceof RoPath || value instanceof RoURLEvent;
}

/**
 * Determines whether or not the given value is a BrightScript boxed number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a boxed number, otherwise `false`.
 */
export function isBoxedNumber(value: BrsType | BrsComponent): value is BoxedNumber {
    return (
        value instanceof RoInt ||
        value instanceof RoFloat ||
        value instanceof RoDouble ||
        value instanceof RoLongInteger
    );
}

/** The set of BrightScript numeric types. */
export type BrsNumber = Int32 | Int64 | Float | Double;

/** The set of BrightScript boxed numeric types. */
export type BoxedNumber = RoInt | RoFloat | RoDouble | RoLongInteger;

/**
 * Determines whether or not the given value can be converted to a number.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` can be converted to a number, otherwise `false`.
 */
export function isAnyNumber(value: BrsType): value is BrsNumber | BoxedNumber {
    return isBrsNumber(value) || isBoxedNumber(value);
}

/**
 * Determines whether or not the given value is a BrightScript event component.
 * @param value the BrightScript value in question.
 * @returns `true` if `value` is a BrightScript event component, otherwise `false`.
 */
export function isBrsEvent(value: BrsType): value is BrsEvent {
    return (
        value instanceof RoURLEvent ||
        value instanceof RoUniversalControlEvent ||
        value instanceof RoSystemLogEvent ||
        value instanceof RoInputEvent ||
        value instanceof RoAudioPlayerEvent ||
        value instanceof RoVideoPlayerEvent ||
        value instanceof RoTextureRequestEvent ||
        value instanceof RoChannelStoreEvent ||
        value instanceof RoDeviceInfoEvent ||
        value instanceof RoCECStatusEvent ||
        value instanceof RoHdmiStatusEvent ||
        value instanceof RoSGNodeEvent ||
        value instanceof RoSGScreenEvent
    );
}

// The set of BrightScript Event components
export type BrsEvent =
    | RoURLEvent
    | RoUniversalControlEvent
    | RoSystemLogEvent
    | RoInputEvent
    | RoAudioPlayerEvent
    | RoVideoPlayerEvent
    | RoTextureRequestEvent
    | RoChannelStoreEvent
    | RoDeviceInfoEvent
    | RoCECStatusEvent
    | RoHdmiStatusEvent
    | RoSGNodeEvent
    | RoSGScreenEvent;

/**
 * The set of all comparable BrightScript types. Only primitive (i.e. intrinsic * and unboxed)
 * BrightScript types are comparable to each other.
 */
export type BrsPrimitive = BrsInterface | BrsInvalid | BrsBoolean | BrsString | BrsNumber;

/** The set of BrightScript iterable types. */
export type Iterable = RoArray | RoAssociativeArray | RoList | RoByteArray | RoXMLList | RoXMLElement;

// this is getting weird - we need a lesThan and greaterThan function?!
export type AllComponents = { kind: ValueKind.Object } & BrsComponent & BrsValue;

/** The set of all supported types in BrightScript. */
export type BrsType = BrsPrimitive | Iterable | Callable | AllComponents | Uninitialized;

// Function to check if the value is a BrightScript Type
export function isBrsType(value: any): value is BrsType {
    return (
        isBrsBoolean(value) ||
        isBrsString(value) ||
        isBrsNumber(value) ||
        value === BrsInvalid.Instance ||
        value instanceof BrsComponent ||
        value instanceof BrsInterface ||
        value instanceof Callable ||
        value instanceof Uninitialized
    );
}

/** The valid ISO Date formats for roDateTime and roTimeSpan parsing */
export const ValidDateFormats = [
    "YYYY-MM-DDTHH:mm:ss.SSS[Z]",
    "YYYY-MM-DDTHH:mm:ss.SSS",
    "YYYY-MM-DDTHH:mm:ss[Z]",
    "YYYY-MM-DDTHH:mm:ss",
    "YYYY-MM-DDTHH:mm[Z]",
    "YYYY-MM-DDTHH:mm",
    "YYYY-MM-DDTHH[Z]",
    "YYYY-MM-DDTHH",
    "YYYY-MM-DDT",
    "YYYY-MM-DD[Z]",
    "YYYY-MM-DD",
    "YYYY-MM[Z]",
    "YYYY-MM",
    "YYYY[Z]",
    "YYYY",
];

/**
 * Interface for a flexible object with string keys and convertible values.
 * This is to be used to behave like and convert to a BrightScript Associative Array.
 */
export interface FlexObject {
    [key: string]: BrsConvertible | BrsConvertible[] | FlexObject | FlexObject[] | Map<string, any> | SharedArrayBuffer;
}

/**
 * A type that can be converted to a BrightScript type.
 */
export type BrsConvertible = boolean | number | string | BrsType | null | undefined;

/**
 * Converts a JavaScript object or Map to a RoAssociativeArray, converting each property or entry to the corresponding BrightScript type.
 * @param input The JavaScript object or Map to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, RoSGNode>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A RoAssociativeArray with the converted properties or entries.
 */
export function toAssociativeArray(
    input: Map<string, any> | FlexObject,
    cs?: boolean,
    nodeMap?: Map<string, RoSGNode>
): RoAssociativeArray {
    const associativeArray = new RoAssociativeArray([], cs);
    if (input instanceof Map) {
        for (const [key, value] of input) {
            associativeArray.set(new BrsString(key), brsValueOf(value, cs, nodeMap), true);
        }
    } else if (typeof input === "object" && input !== null) {
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                associativeArray.set(new BrsString(key), brsValueOf(input[key], cs, nodeMap), true);
            }
        }
    } else {
        throw new Error(`Unsupported input type: ${typeof input}`);
    }
    return associativeArray;
}

/**
 * Converts a value to its representation as a BrsType. If no such
 * representation is possible, throws an Error.
 * @param {any} value Some value.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, RoSGNode>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @return {BrsType} The BrsType representation of `x`.
 * @throws {Error} If `x` cannot be represented as a BrsType.
 */
export function brsValueOf(value: any, cs?: boolean, nodeMap?: Map<string, RoSGNode>): BrsType {
    if (value === null || value === undefined) {
        return BrsInvalid.Instance;
    }
    const maxInt = 0x80000000;
    const t: string = typeof value;
    switch (t) {
        case "boolean":
            return BrsBoolean.from(value);
        case "string":
            return new BrsString(value);
        case "number":
            if (Number.isInteger(value)) {
                return value >= -maxInt && value < maxInt ? new Int32(value) : new Int64(value);
            } else if (Number.isNaN(value)) {
                return new Float(value);
            }
            return value >= -3.4e38 && value <= 3.4e38 ? new Float(value) : new Double(value);
        case "object":
            return fromObject(value, cs, nodeMap);
        case "undefined":
            return Uninitialized.Instance;
        default:
            throw new Error(`brsValueOf not implemented for: ${value} <${t}>`);
    }
}

/**
 * Converts a JavaScript object to a BrsType.
 * @param obj The JavaScript object to convert.
 * @param {boolean} cs Whether to return an AA as case sensitive.
 * @param {Map<string, RoSGNode>} nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A BrsType with the converted object or Invalid if the object is not transferable.
 */
function fromObject(obj: any, cs?: boolean, nodeMap?: Map<string, RoSGNode>): BrsType {
    if (isBrsType(obj)) {
        return obj;
    } else if (obj === null) {
        return BrsInvalid.Instance;
    } else if (obj instanceof Uint8Array) {
        return new RoByteArray(obj);
    } else if (Array.isArray(obj)) {
        return new RoArray(
            obj.map(function (el: any) {
                return brsValueOf(el, cs, nodeMap);
            })
        );
    } else if (obj["_node_"] || obj["_circular_"]) {
        // Handle both regular nodes and circular references
        const nodeInfo = obj["_node_"] ? obj["_node_"].split(":") : obj["_circular_"].split(":");
        if (nodeInfo.length === 2) {
            return toSGNode(obj, nodeInfo[0], nodeInfo[1], nodeMap);
        }
        return BrsInvalid.Instance;
    } else if (obj["_component_"]) {
        const component = obj["_component_"];
        const ctor = BrsObjects.get(component);
        if (ctor) {
            try {
                return ctor();
            } catch (err) {
                return BrsInvalid.Instance;
            }
        }
        return BrsInvalid.Instance;
    } else if (obj["_interface_"]) {
        return BrsInvalid.Instance;
    } else if (obj["_callable_"]) {
        return new Callable(obj["_callable_"], {
            signature: {
                args: [new StdlibArgument("arg", ValueKind.Dynamic, BrsInvalid.Instance)],
                variadic: true,
                returns: ValueKind.Void,
            },
            impl: (_: any, ..._arg: BrsType[]) => {
                return Uninitialized.Instance;
            },
        });
    }
    return toAssociativeArray(obj, cs, nodeMap);
}

/**
 * Converts a JavaScript object to a RoSGNode, converting each field to the corresponding BrightScript type.
 * @param obj The JavaScript object to convert.
 * @param type The type of the node.
 * @param subtype The subtype of the node.
 * @param nodeMap Optional map to track nodes by ID for resolving circular references.
 * @returns A RoSGNode with the converted fields.
 */
export function toSGNode(obj: any, type: string, subtype: string, nodeMap?: Map<string, RoSGNode>): RoSGNode {
    // Initialize nodeMap on first call
    nodeMap ??= new Map<string, RoSGNode>();

    // Check if this is a circular reference
    if (obj["_circular_"] && obj["_address_"]) {
        const existingNode = nodeMap.get(obj["_address_"]);
        if (existingNode) {
            return existingNode;
        }
        // If we don't have the node yet, this might be a forward reference
        // Return invalid for now (should not happen in valid serialized data)
        return BrsInvalid.Instance as any;
    }
    const newNode = SGNodeFactory.createNode(type, subtype) ?? new RoSGNode([], subtype);
    // Store the node in the map using the original address for circular reference resolution
    // Use the address from serialized data if available, otherwise use the new node's address
    newNode.sgNode.address = obj["_address_"] || newNode.sgNode.address;
    nodeMap.set(newNode.sgNode.address, newNode);

    for (const key in obj) {
        if (key.startsWith("_") && key.endsWith("_") && key.length > 2) {
            continue;
        }
        newNode.setFieldValue(key, brsValueOf(obj[key], undefined, nodeMap));
    }
    if (obj["_children_"]) {
        for (const child of obj["_children_"]) {
            if (child["_node_"] || child["_circular_"]) {
                const childInfo = child["_node_"] ? child["_node_"].split(":") : child["_circular_"].split(":");
                const childNode = toSGNode(child, childInfo[0], childInfo[1], nodeMap);
                newNode.appendChildToParent(childNode);
            } else if (child["_invalid_"] !== undefined) {
                newNode.appendChildToParent(BrsInvalid.Instance);
            }
        }
    }
    return newNode;
}

/**
 * Converts a RoAssociativeArray to a JavaScript object, converting each property to the corresponding JavaScript type.
 * @param associativeArray The RoAssociativeArray to convert.
 * @returns A JavaScript object with the converted properties.
 */
export function fromAssociativeArray(associativeArray: RoAssociativeArray): FlexObject {
    const result: FlexObject = {};

    for (const [key, value] of associativeArray.elements) {
        if (isUnboxable(value)) {
            result[key] = jsValueOf(value.unbox());
        } else {
            result[key] = jsValueOf(value);
        }
    }

    return result;
}

/**
 * Converts a roAssociativeArray to a ContentNode component
 * @param associativeArray The RoAssociativeArray to convert.
 * @returns A ContentNode object with the converted fields.
 */
export function toContentNode(associativeArray: RoAssociativeArray): ContentNode {
    const result: ContentNode = new ContentNode();

    for (const [key, value] of associativeArray.elements) {
        result.setFieldValue(key, value);
    }

    return result;
}

/**
 * Converts a ContentNode component into a roAssociativeArray
 * @param contentNode The content node to be converted
 * @returns An associative array with the converted data
 */
export function fromContentNode(contentNode: ContentNode): RoAssociativeArray {
    const result: RoAssociativeArray = new RoAssociativeArray([], true);

    for (const [key, value] of contentNode.getNodeFields()) {
        result.set(new BrsString(key), value.getValue(false));
    }

    return result;
}

/**
 * Converts a BrsType value to its representation as a JavaScript type.
 * @param {BrsType} value Some BrsType value.
 * @param {WeakSet<RoSGNode>} visitedNodes Optional set to track visited nodes for circular reference detection.
 * @return {any} The JavaScript representation of `x`.
 */
export function jsValueOf(value: BrsType, visitedNodes?: WeakSet<RoSGNode>): any {
    if (isUnboxable(value)) {
        value = value.unbox();
    }
    switch (value.kind) {
        case ValueKind.Invalid:
            return null;
        case ValueKind.Uninitialized:
            return undefined;
        case ValueKind.Boolean:
            return value.toBoolean();
        case ValueKind.String:
            return value.value;
        case ValueKind.Int32:
        case ValueKind.Float:
        case ValueKind.Double:
            return value.getValue();
        case ValueKind.Int64:
            return value.getValue().toNumber();
        case ValueKind.Interface:
        case ValueKind.Object:
            if (value instanceof RoArray || value instanceof RoList) {
                return value.elements.map((el) => jsValueOf(el, visitedNodes));
            } else if (value instanceof RoByteArray) {
                return value.elements;
            } else if (value instanceof RoSGNode) {
                return fromSGNode(value, true, visitedNodes);
            } else if (value instanceof RoAssociativeArray) {
                return fromAssociativeArray(value);
            } else if (value instanceof BrsComponent) {
                return { _component_: value.getComponentName() };
            } else if (value instanceof BrsInterface) {
                return { _interface_: value.getInterfaceName() };
            }
            break;
        case ValueKind.Callable:
            return { _callable_: value.name };
    }
}

/**
 * Converts a RoSGNode to a JavaScript object, converting each field to the corresponding JavaScript type.
 * @param node The RoSGNode to convert.
 * @param deep Whether to recursively convert child nodes. Defaults to true.
 * @param visited Optional WeakSet to track visited nodes and prevent circular references.
 * @returns A JavaScript object with the converted fields.
 */
export function fromSGNode(node: RoSGNode, deep: boolean = true, visited?: WeakSet<RoSGNode>): FlexObject {
    visited ??= new WeakSet<RoSGNode>();
    if (visited.has(node)) {
        return {
            _circular_: `${getNodeType(node.nodeSubtype)}:${node.nodeSubtype}`,
            _address_: node.sgNode.address,
        };
    }
    visited.add(node);

    const result: FlexObject = {};
    const fields = node.getNodeFields();
    const observed: string[] = [];

    result["_node_"] = `${getNodeType(node.nodeSubtype)}:${node.nodeSubtype}`;
    result["_address_"] = node.sgNode.address;

    for (const [name, field] of fields) {
        if (!field.isHidden()) {
            let fieldValue = field.getValue(false);
            if (isUnboxable(fieldValue)) {
                fieldValue = fieldValue.unbox();
            }
            if (node instanceof Task && field.isPortObserved(node)) {
                observed.push(name);
            }
            if (fieldValue instanceof RoSGNode) {
                result[name] = fromSGNode(fieldValue, deep, visited);
                continue;
            }
            result[name] = jsValueOf(fieldValue, visited);
        }
    }
    if (observed.length) {
        result["_observed_"] = observed;
    }
    const children = node.getNodeChildren();
    if (deep && children.length > 0) {
        result["_children_"] = children.map((child: RoSGNode | BrsInvalid) => {
            if (child instanceof BrsInvalid) {
                return { _invalid_: null };
            }
            return fromSGNode(child, deep, visited);
        });
    }

    return result;
}

/**
 * Checks if a BrsType value is invalid.
 * @param value The BrsType value to check.
 * @returns True if the value is invalid, false otherwise.
 */
export function isInvalid(value: BrsType): boolean {
    return value.equalTo(BrsInvalid.Instance).toBoolean();
}

/**
 * Checks if a string represents a number and returns its precision.
 * The precision is equivalent to the Number.toPrecision() parameter (total significant digits).
 * @param {string} str - The string to check
 * @returns {number | null} - The precision (significant digits count) or null if not a valid number
 */
export function getFloatingPointPrecision(str: string): number | null {
    // Remove leading/trailing whitespace
    const trimmed = str.trim();

    // Early return for empty string
    if (!trimmed) {
        return null;
    }
    // Check if it's a valid number format (including scientific notation)
    // More efficient regex that captures the parts we need
    const numberRegex = /^([+-]?)(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
    const numberMatch = numberRegex.exec(trimmed);
    if (!numberMatch) {
        return null;
    }
    const [, _sign, mantissa, exponent] = numberMatch;
    // Parse the number to ensure it's valid (but we already validated format)
    const num = Number.parseFloat(trimmed);
    if (!Number.isFinite(num)) {
        return null;
    }
    // Quick check for integer without decimal point or scientific notation
    if (!mantissa.includes(".") && !exponent) {
        return 0; // Integer numbers return precision 0
    }
    // For scientific notation, we only need to count digits in the mantissa
    // No need to convert to decimal form
    let workingStr = mantissa;
    // Count significant digits more efficiently
    let significantDigits = 0;
    let foundFirstNonZero = false;
    for (const char of workingStr) {
        if (char === ".") {
            continue; // Skip decimal point
        }

        if (char !== "0" || foundFirstNonZero) {
            significantDigits++;
            foundFirstNonZero = true;
        }
    }
    return significantDigits;
}
