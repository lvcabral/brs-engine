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
import { RoSystemLog } from "./RoSystemLog";
import { RoFontRegistry } from "./RoFontRegistry";
import { RoCompositor } from "./RoCompositor";
import { RoPath } from "./RoPath";
import { RoBitmap, createBitmap } from "./RoBitmap";
import { createRegion } from "./RoRegion";
import { createScreen, RoScreen } from "./RoScreen";
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
    private readonly map = new Map<
        string,
        { originalKey: string; value: Function; params: number }
    >();

    constructor(entries: [string, Function, number?][]) {
        entries.forEach(([key, value, params]) => this.set(key, value, params));
    }

    get(key: string) {
        const entry = this.map.get(key.toLowerCase());
        return entry ? entry.value : undefined;
    }

    set(key: string, value: Function, params?: number) {
        return this.map.set(key.toLowerCase(), {
            originalKey: key,
            value: value,
            params: params ?? 0,
        });
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

    // Returns the number of parameters required by the object constructor.
    // >=0 = exact number of parameters required
    // -1  = ignore parameters, create object with no parameters
    // -2  = do not check for minimum number of parameters
    params(key: string) {
        const entry = this.map.get(key.toLowerCase());
        return entry ? entry.params : -1;
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
        2,
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
        2,
    ],
    ["roString", (interpreter: Interpreter) => new RoString(), -1],
    ["roBoolean", (interpreter: Interpreter, literal: BrsBoolean) => new RoBoolean(literal), -1],
    ["roDouble", (interpreter: Interpreter, literal: Double) => new RoDouble(literal), -1],
    ["roFloat", (interpreter: Interpreter, literal: Float) => new RoFloat(literal), -1],
    ["roInt", (interpreter: Interpreter, literal: Int32) => new RoInt(literal), -1],
    ["roLongInteger", (interpreter: Interpreter, literal: Int64) => new RoLongInteger(literal), -1],
    ["roFunction", (interpreter: Interpreter, sub: Callable) => new RoFunction(sub)],
    ["roPath", (interpreter: Interpreter, path: BrsString) => new RoPath(path), 1],
    [
        "roBitmap",
        (interpreter: Interpreter, param: BrsComponent) => createBitmap(interpreter, param),
        1,
    ],
    ["roImageMetadata", (interpreter: Interpreter) => new RoImageMetadata()],
    ["roMessagePort", (interpreter: Interpreter) => new RoMessagePort()],
    ["roInput", (interpreter: Interpreter) => new RoInput()],
    ["roSystemLog", (interpreter: Interpreter) => new RoSystemLog()],
    ["roFileSystem", (interpreter: Interpreter) => new RoFileSystem()],
    ["roLocalization", (interpreter: Interpreter) => new RoLocalization(interpreter)],
    ["roFontRegistry", (interpreter: Interpreter) => new RoFontRegistry(interpreter)],
    ["roRegistry", (interpreter: Interpreter) => new RoRegistry()],
    [
        "roRegistrySection",
        (interpreter: Interpreter, section: BrsString) =>
            new RoRegistrySection(interpreter, section),
        1,
    ],
    ["roAppInfo", (interpreter: Interpreter) => new RoAppInfo()],
    ["roDeviceInfo", (interpreter: Interpreter) => new RoDeviceInfo()],
    ["roRemoteInfo", (interpreter: Interpreter) => new RoRemoteInfo()],
    ["roAppMemoryMonitor", (interpreter: Interpreter) => new RoAppMemoryMonitor()],
    ["roAudioPlayer", (interpreter: Interpreter) => new RoAudioPlayer()],
    [
        "roAudioResource",
        (interpreter: Interpreter, name: BrsString) => createAudioResource(interpreter, name),
        1,
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
        5,
    ],
    [
        "roScreen",
        (interpreter: Interpreter, dblbuffer?: BrsBoolean, width?: Int32, height?: Int32) =>
            createScreen(interpreter, dblbuffer, width, height),
        -2,
    ],
    ["roXMLElement", (interpreter: Interpreter) => new RoXMLElement()],
    ["roURLTransfer", (interpreter: Interpreter) => new RoURLTransfer(interpreter)],
    ["roInvalid", (interpreter: Interpreter) => new RoInvalid(), -1],
    ["roNDK", (interpreter: Interpreter) => new RoNDK()],
]);
