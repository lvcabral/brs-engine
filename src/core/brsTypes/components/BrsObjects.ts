import { BrsType } from "..";
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
import { getTextureManager } from "./RoTextureManager";
import { RoTextureRequest } from "./RoTextureRequest";
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
import { RoCECStatus } from "./RoCECStatus";
import { RoSocketAddress } from "./RoSocketAddress";
import { RoStreamSocket } from "./RoStreamSocket";
import { RoHdmiStatus } from "./RoHdmiStatus";

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
    ["roAppManager", (_: Interpreter) => new RoAppManager()],
    ["roAssociativeArray", (_: Interpreter) => new RoAssociativeArray([])],
    [
        "roArray",
        (_: Interpreter, capacity: Int32 | Float, resizable: BrsBoolean) =>
            new RoArray(capacity, resizable),
        2,
    ],
    ["roByteArray", (_: Interpreter) => new RoByteArray()],
    ["roEVPCipher", (_: Interpreter) => new RoEVPCipher()],
    ["roEVPDigest", (_: Interpreter) => new RoEVPDigest()],
    ["roHMAC", (_: Interpreter) => new RoHMAC()],
    ["roDeviceCrypto", (interpreter: Interpreter) => new RoDeviceCrypto(interpreter)],
    ["roChannelStore", (_: Interpreter) => new RoChannelStore()],
    ["roDateTime", (_: Interpreter) => new RoDateTime()],
    ["roList", (_: Interpreter) => new RoList()],
    ["roTimespan", (_: Interpreter) => new RoTimespan()],
    [
        "roRegex",
        (_: Interpreter, expression: BrsString, flags: BrsString) => new RoRegex(expression, flags),
        2,
    ],
    ["roString", (_: Interpreter) => new RoString(), -1],
    ["roBoolean", (_: Interpreter, literal: BrsBoolean) => new RoBoolean(literal), -1],
    ["roDouble", (_: Interpreter, literal: Double) => new RoDouble(literal), -1],
    ["roFloat", (_: Interpreter, literal: Float) => new RoFloat(literal), -1],
    ["roInt", (_: Interpreter, literal: Int32) => new RoInt(literal), -1],
    ["roLongInteger", (_: Interpreter, literal: Int64) => new RoLongInteger(literal), -1],
    ["roFunction", (_: Interpreter, sub: Callable) => new RoFunction(sub)],
    ["roPath", (_: Interpreter, path: BrsString) => new RoPath(path), 1],
    ["roBitmap", (interpreter: Interpreter, param: BrsType) => createBitmap(interpreter, param), 1],
    ["roTextureRequest", (_: Interpreter, url: BrsString) => new RoTextureRequest(url), 1],
    ["roTextureManager", (interpreter: Interpreter) => getTextureManager(interpreter)],
    ["roImageMetadata", (_: Interpreter) => new RoImageMetadata()],
    ["roMessagePort", (_: Interpreter) => new RoMessagePort()],
    ["roInput", (interpreter: Interpreter) => new RoInput(interpreter)],
    ["roSystemLog", (interpreter: Interpreter) => new RoSystemLog(interpreter)],
    ["roFileSystem", (_: Interpreter) => new RoFileSystem()],
    ["roLocalization", (interpreter: Interpreter) => new RoLocalization(interpreter)],
    ["roFontRegistry", (interpreter: Interpreter) => new RoFontRegistry(interpreter)],
    ["roRegistry", (_: Interpreter) => new RoRegistry()],
    [
        "roRegistrySection",
        (interpreter: Interpreter, section: BrsString) =>
            new RoRegistrySection(interpreter, section),
        1,
    ],
    ["roAppInfo", (_: Interpreter) => new RoAppInfo()],
    ["roDeviceInfo", (interpreter: Interpreter) => new RoDeviceInfo(interpreter)],
    ["roRemoteInfo", (_: Interpreter) => new RoRemoteInfo()],
    ["roAppMemoryMonitor", (_: Interpreter) => new RoAppMemoryMonitor()],
    ["roAudioPlayer", (interpreter: Interpreter) => new RoAudioPlayer(interpreter)],
    [
        "roAudioResource",
        (interpreter: Interpreter, name: BrsString) => createAudioResource(interpreter, name),
        1,
    ],
    ["roAudioMetadata", (_: Interpreter) => new RoAudioMetadata()],
    ["roVideoPlayer", (interpreter: Interpreter) => new RoVideoPlayer(interpreter)],
    ["roCompositor", (_: Interpreter) => new RoCompositor()],
    [
        "roRegion",
        (
            _: Interpreter,
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
    ["roXMLElement", (_: Interpreter) => new RoXMLElement()],
    ["roURLTransfer", (interpreter: Interpreter) => new RoURLTransfer(interpreter)],
    ["roInvalid", (_: Interpreter) => new RoInvalid(), -1],
    ["roNDK", (_: Interpreter) => new RoNDK()],
    ["roCECStatus", (interpreter: Interpreter) => new RoCECStatus(interpreter)],
    ["roHdmiStatus", (interpreter: Interpreter) => new RoHdmiStatus(interpreter)],
    ["roSocketAddress", (interpreter: Interpreter) => new RoSocketAddress(interpreter)],
    ["roStreamSocket", (interpreter: Interpreter) => new RoStreamSocket(interpreter)],
]);
