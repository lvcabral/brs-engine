import { BrsComponent } from "./BrsComponent";
import { RoAppManager } from "./RoAppManager";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { RoByteArray } from "./RoByteArray";
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
import { roBoolean } from "./RoBoolean";
import { roDouble } from "./RoDouble";
import { roFloat } from "./RoFloat";
import { roInt } from "./RoInt";
import { roLongInteger } from "./RoLongInteger";
import { Double } from "../Double";
import { Float } from "../Float";
import { Int32 } from "../Int32";
import { Int64 } from "../Int64";
import { roInvalid } from "./RoInvalid";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roappmanager", (interpreter: Interpreter) => new RoAppManager()],
    ["roassociativearray", (interpreter: Interpreter) => new RoAssociativeArray([])],
    ["roarray", (interpreter: Interpreter) => new RoArray([])],
    ["robytearray", (interpreter: Interpreter) => new RoByteArray()],
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
    ["roboolean", (interpreter: Interpreter, literal: BrsBoolean) => new roBoolean(literal)],
    ["rodouble", (interpreter: Interpreter, literal: Double) => new roDouble(literal)],
    ["rofloat", (interpreter: Interpreter, literal: Float) => new roFloat(literal)],
    ["roint", (interpreter: Interpreter, literal: Int32) => new roInt(literal)],
    ["rolonginteger", (interpreter: Interpreter, literal: Int64) => new roLongInteger(literal)],
    ["ropath", (interpreter: Interpreter, path: BrsString) => new RoPath(path)],
    [
        "robitmap",
        (interpreter: Interpreter, param: BrsComponent) => createBitmap(interpreter, param),
    ],
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
    ["roinvalid", (interpreter: Interpreter) => new roInvalid()],
]);
