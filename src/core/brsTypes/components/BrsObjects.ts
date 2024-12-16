import { BrsComponent } from "./BrsComponent";
import { RoAppManager } from "./RoAppManager";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { RoByteArray } from "./RoByteArray";
import { RoEVPCipher } from "./RoEVPCipher";
import { RoEVPDigest } from "./RoEVPDigest";
import { RoHMAC } from "./RoHMAC";
import { RoDeviceCrypto } from "./RoDeviceCrypto";
import { RoChannelStore } from "./RoChannelStore";
import { RoAppMemoryMonitor } from "./RoAppMemoryMonitor";
import { RoDateTime } from "./RoDateTime";
import { RoTimespan } from "./RoTimespan";
import { RoList } from "./RoList";
import { RoRegex } from "./RoRegex";
import { BrsString, BrsBoolean } from "../BrsType";
import { RoMessagePort } from "./RoMessagePort";
import { RoInput } from "./RoInput";
import { RoFontRegistry } from "./RoFontRegistry";
import { RoCompositor } from "./RoCompositor";
import { RoPath } from "./RoPath";
import { RoBitmap, createBitmap } from "./RoBitmap";
import { createRegion } from "./RoRegion";
import { RoScreen } from "./RoScreen";
import { RoImageMetadata } from "./RoImageMetadata";
import { RoAudioMetadata } from "./RoAudioMetadata";
import { RoAudioPlayer } from "./RoAudioPlayer";
import { RoVideoPlayer } from "./RoVideoPlayer";
import { RoXMLElement } from "./RoXMLElement";
import { RoURLTransfer } from "./RoURLTransfer";
import { createAudioResource } from "./RoAudioResource";
import { RoLocalization } from "./RoLocalization";
import { RoRegistry } from "./RoRegistry";
import { RoRegistrySection } from "./RoRegistrySection";
import { RoAppInfo } from "./RoAppInfo";
import { RoDeviceInfo } from "./RoDeviceInfo";
import { RoRemoteInfo } from "./RoRemoteInfo";
import { RoFileSystem } from "./RoFileSystem";
import { Interpreter } from "../../interpreter";
import { RoString } from "./RoString";
import { RoBoolean } from "./RoBoolean";
import { RoDouble } from "./RoDouble";
import { RoFloat } from "./RoFloat";
import { RoInt } from "./RoInt";
import { RoLongInteger } from "./RoLongInteger";
import { Double } from "../Double";
import { Float } from "../Float";
import { Int32 } from "../Int32";
import { Int64 } from "../Int64";
import { RoInvalid } from "./RoInvalid";
import { RoFunction } from "./RoFunction";
import { Callable } from "../Callable";
import { RoNDK } from "./RoNDK";

// Class to define a case-insensitive map of BrightScript objects.
class BrsObjectsMap {
    private readonly map = new Map<string, { originalKey: string; value: Function }>();

    constructor(entries: [string, Function][]) {
        entries.forEach(([key, value]) => this.set(key, value));
    }

    get(key: string) {
        const entry = this.map.get(key.toLowerCase());
        return entry ? entry.value : undefined;
    }

    set(key: string, value: Function) {
        return this.map.set(key.toLowerCase(), { originalKey: key, value: value });
    }

    has(key: string) {
        return this.map.has(key.toLowerCase());
    }

    delete(key: string) {
        return this.map.delete(key.toLowerCase());
    }

    clear() {
        return this.map.clear();
    }

    values() {
        return Array.from(this.map.values()).map((entry) => entry.value);
    }

    keys() {
        return Array.from(this.map.values()).map((entry) => entry.originalKey);
    }
}

/** Map containing a list of BrightScript components that can be created with CreateObject(). */
export const BrsObjects = new BrsObjectsMap([
    ["roAppManager", (interpreter: Interpreter) => new RoAppManager()],
    ["roAssociativeArray", (interpreter: Interpreter) => new RoAssociativeArray([])],
    [
        "roArray",
        (interpreter: Interpreter, capacity: Int32 | Float, resizable: BrsBoolean) =>
            new RoArray(capacity, resizable),
    ],
    ["roByteArray", (interpreter: Interpreter) => new RoByteArray()],
    ["roEVPCipher", (interpreter: Interpreter) => new RoEVPCipher()],
    ["roEVPDigest", (interpreter: Interpreter) => new RoEVPDigest()],
    ["roHMAC", (interpreter: Interpreter) => new RoHMAC()],
    ["roDeviceCrypto", (interpreter: Interpreter) => new RoDeviceCrypto(interpreter)],
    ["roChannelStore", (interpreter: Interpreter) => new RoChannelStore()],
    ["roDateTime", (interpreter: Interpreter) => new RoDateTime()],
    ["roList", (interpreter: Interpreter) => new RoList()],
    ["roTimespan", (interpreter: Interpreter) => new RoTimespan()],
    [
        "roRegex",
        (interpreter: Interpreter, expression: BrsString, flags: BrsString) =>
            new RoRegex(expression, flags),
    ],
    ["roString", (interpreter: Interpreter) => new RoString()],
    ["roBoolean", (interpreter: Interpreter, literal: BrsBoolean) => new RoBoolean(literal)],
    ["roDouble", (interpreter: Interpreter, literal: Double) => new RoDouble(literal)],
    ["roFloat", (interpreter: Interpreter, literal: Float) => new RoFloat(literal)],
    ["roInt", (interpreter: Interpreter, literal: Int32) => new RoInt(literal)],
    ["roLongInteger", (interpreter: Interpreter, literal: Int64) => new RoLongInteger(literal)],
    ["roFunction", (interpreter: Interpreter, sub: Callable) => new RoFunction(sub)],
    ["roPath", (interpreter: Interpreter, path: BrsString) => new RoPath(path)],
    [
        "roBitmap",
        (interpreter: Interpreter, param: BrsComponent) => createBitmap(interpreter, param),
    ],
    ["roImageMetadata", (interpreter: Interpreter) => new RoImageMetadata()],
    ["roMessagePort", (interpreter: Interpreter) => new RoMessagePort()],
    ["roInput", (interpreter: Interpreter) => new RoInput()],
    ["roFileSystem", (interpreter: Interpreter) => new RoFileSystem()],
    ["roLocalization", (interpreter: Interpreter) => new RoLocalization(interpreter)],
    ["roFontRegistry", (interpreter: Interpreter) => new RoFontRegistry(interpreter)],
    ["roRegistry", (interpreter: Interpreter) => new RoRegistry()],
    [
        "roRegistrySection",
        (interpreter: Interpreter, section: BrsString) =>
            new RoRegistrySection(interpreter, section),
    ],
    ["roAppInfo", (interpreter: Interpreter) => new RoAppInfo()],
    ["roDeviceInfo", (interpreter: Interpreter) => new RoDeviceInfo()],
    ["roRemoteInfo", (interpreter: Interpreter) => new RoRemoteInfo()],
    ["roAppMemoryMonitor", (interpreter: Interpreter) => new RoAppMemoryMonitor()],
    ["roAudioPlayer", (interpreter: Interpreter) => new RoAudioPlayer()],
    [
        "roAudioResource",
        (interpreter: Interpreter, name: BrsString) => createAudioResource(interpreter, name),
    ],
    ["roAudioMetadata", (interpreter: Interpreter) => new RoAudioMetadata()],
    ["roVideoPlayer", (interpreter: Interpreter) => new RoVideoPlayer()],
    ["roCompositor", (interpreter: Interpreter) => new RoCompositor()],
    [
        "roRegion",
        (
            interpreter: Interpreter,
            bitmap: RoBitmap | RoScreen,
            x: Int32,
            y: Int32,
            width: Int32,
            height: Int32
        ) => createRegion(bitmap, x, y, width, height),
    ],
    [
        "roScreen",
        (interpreter: Interpreter, dblbuffer?: BrsBoolean, width?: Int32, height?: Int32) =>
            new RoScreen(interpreter, dblbuffer, width, height),
    ],
    ["roXMLElement", (interpreter: Interpreter) => new RoXMLElement()],
    ["roURLTransfer", (interpreter: Interpreter) => new RoURLTransfer(interpreter)],
    ["roInvalid", (interpreter: Interpreter) => new RoInvalid()],
    ["roNDK", (interpreter: Interpreter) => new RoNDK()],
]);
