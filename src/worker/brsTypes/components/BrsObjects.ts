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

/** Map containing a list of BrightScript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roappmanager", (interpreter: Interpreter) => new RoAppManager()],
    ["roassociativearray", (interpreter: Interpreter) => new RoAssociativeArray([])],
    [
        "roarray",
        (interpreter: Interpreter, capacity: Int32 | Float, resizable: BrsBoolean) =>
            new RoArray(capacity, resizable),
    ],
    ["robytearray", (interpreter: Interpreter) => new RoByteArray()],
    ["roevpcipher", (interpreter: Interpreter) => new RoEVPCipher()],
    ["roevpdigest", (interpreter: Interpreter) => new RoEVPDigest()],
    ["rohmac", (interpreter: Interpreter) => new RoHMAC()],
    ["rodevicecrypto", (interpreter: Interpreter) => new RoDeviceCrypto(interpreter)],
    ["rochannelstore", (interpreter: Interpreter) => new RoChannelStore()],
    ["rodatetime", (interpreter: Interpreter) => new RoDateTime()],
    ["rolist", (interpreter: Interpreter) => new RoList()],
    ["rotimespan", (interpreter: Interpreter) => new RoTimespan()],
    [
        "roregex",
        (interpreter: Interpreter, expression: BrsString, flags: BrsString) =>
            new RoRegex(expression, flags),
    ],
    ["rostring", (interpreter: Interpreter) => new RoString()],
    ["roboolean", (interpreter: Interpreter, literal: BrsBoolean) => new RoBoolean(literal)],
    ["rodouble", (interpreter: Interpreter, literal: Double) => new RoDouble(literal)],
    ["rofloat", (interpreter: Interpreter, literal: Float) => new RoFloat(literal)],
    ["roint", (interpreter: Interpreter, literal: Int32) => new RoInt(literal)],
    ["rolonginteger", (interpreter: Interpreter, literal: Int64) => new RoLongInteger(literal)],
    ["rofunction", (interpreter: Interpreter, sub: Callable) => new RoFunction(sub)],
    ["ropath", (interpreter: Interpreter, path: BrsString) => new RoPath(path)],
    [
        "robitmap",
        (interpreter: Interpreter, param: BrsComponent) => createBitmap(interpreter, param),
    ],
    ["roimagemetadata", (interpreter: Interpreter) => new RoImageMetadata()],
    ["romessageport", (interpreter: Interpreter) => new RoMessagePort()],
    ["roinput", (interpreter: Interpreter) => new RoInput()],
    ["rofilesystem", (interpreter: Interpreter) => new RoFileSystem()],
    ["rolocalization", (interpreter: Interpreter) => new RoLocalization(interpreter)],
    ["rofontregistry", (interpreter: Interpreter) => new RoFontRegistry(interpreter)],
    ["roregistry", (interpreter: Interpreter) => new RoRegistry()],
    [
        "roregistrysection",
        (interpreter: Interpreter, section: BrsString) =>
            new RoRegistrySection(interpreter, section),
    ],
    ["roappinfo", (interpreter: Interpreter) => new RoAppInfo()],
    ["rodeviceinfo", (interpreter: Interpreter) => new RoDeviceInfo()],
    ["roappmemorymonitor", (interpreter: Interpreter) => new RoAppMemoryMonitor()],
    ["roaudioplayer", (interpreter: Interpreter) => new RoAudioPlayer()],
    [
        "roaudioresource",
        (interpreter: Interpreter, name: BrsString) => createAudioResource(interpreter, name),
    ],
    ["roaudiometadata", (interpreter: Interpreter) => new RoAudioMetadata()],
    ["rovideoplayer", (interpreter: Interpreter) => new RoVideoPlayer()],
    ["rocompositor", (interpreter: Interpreter) => new RoCompositor()],
    [
        "roregion",
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
        "roscreen",
        (interpreter: Interpreter, dblbuffer?: BrsBoolean, width?: Int32, height?: Int32) =>
            new RoScreen(interpreter, dblbuffer, width, height),
    ],
    ["roxmlelement", (interpreter: Interpreter) => new RoXMLElement()],
    ["rourltransfer", (interpreter: Interpreter) => new RoURLTransfer(interpreter)],
    ["roinvalid", (interpreter: Interpreter) => new RoInvalid()],
]);
