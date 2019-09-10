import { BrsComponent } from "./BrsComponent";
import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { RoByteArray } from "./RoByteArray";
import { RoDateTime } from "./RoDateTime";
import { Timespan } from "./RoTimespan";
import { RoList } from "./RoList";
import { RoRegex } from "./RoRegex";
import { BrsString, BrsBoolean } from "../BrsType";
import { RoMessagePort } from "./RoMessagePort";
import { RoFontRegistry } from "./RoFontRegistry";
import { RoCompositor } from "./RoCompositor";
import { RoPath } from "./RoPath";
import { RoBitmap, createBitmap } from "./RoBitmap";
import { RoRegion } from "./RoRegion";
import { RoScreen } from "./RoScreen";
import { RoAudioPlayer } from "./RoAudioPlayer";
import { RoXMLElement } from "./RoXMLElement";
import { RoAudioResource } from "./RoAudioResource";
import { RoRegistry } from "./RoRegistry";
import { RoRegistrySection } from "./RoRegistrySection";
import { RoDeviceInfo } from "./RoDeviceInfo";
import { RoFileSystem } from "./RoFileSystem";
import { Interpreter } from "../../interpreter";
import { RoString } from "./RoString";
import { roBoolean } from "./RoBoolean";
import { roDouble } from "./RoDouble";
import { roFloat } from "./RoFloat";
import { roInt } from "./RoInt";
import { Double } from "../Double";
import { Float } from "../Float";
import { Int32 } from "../Int32";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", (interpreter: Interpreter) => new RoAssociativeArray([])],
    ["roarray", (interpreter: Interpreter) => new RoArray([])],
    ["robytearray", (interpreter: Interpreter) => new RoByteArray()],
    ["rodatetime", (interpreter: Interpreter) => new RoDateTime()],
    ["rolist", (interpreter: Interpreter) => new RoList()],
    ["rotimespan", (interpreter: Interpreter) => new Timespan()],
    [
        "roregex",
        (interpreter: Interpreter, expression: BrsString, flags: BrsString) =>
            new RoRegex(expression, flags),
    ],
    ["rostring", (interpreter: Interpreter, literal: BrsString) => new RoString(literal)],
    ["roboolean", (interpreter: Interpreter, literal: BrsBoolean) => new roBoolean(literal)],
    ["rodouble", (interpreter: Interpreter, literal: Double) => new roDouble(literal)],
    ["rofloat", (interpreter: Interpreter, literal: Float) => new roFloat(literal)],
    ["roint", (interpreter: Interpreter, literal: Int32) => new roInt(literal)],
    ["ropath", (interpreter: Interpreter, path: BrsString) => new RoPath(path)],
    [
        "robitmap",
        (interpreter: Interpreter, param: BrsComponent) => createBitmap(interpreter, param),
    ],
    ["romessageport", (interpreter: Interpreter) => new RoMessagePort()],
    ["rofilesystem", (interpreter: Interpreter) => new RoFileSystem()],
    ["rofontregistry", (interpreter: Interpreter) => new RoFontRegistry(interpreter)],
    ["roregistry", (interpreter: Interpreter) => new RoRegistry()],
    [
        "roregistrysection",
        (interpreter: Interpreter, section: BrsString) =>
            new RoRegistrySection(interpreter, section),
    ],
    ["rodeviceinfo", (interpreter: Interpreter) => new RoDeviceInfo()],
    ["roaudioplayer", (interpreter: Interpreter) => new RoAudioPlayer()],
    ["roaudioresource", (interpreter: Interpreter, name: BrsString) => new RoAudioResource(name)],
    ["rocompositor", (interpreter: Interpreter) => new RoCompositor()],
    [
        "roregion",
        (
            interpreter: Interpreter,
            bitmap: RoBitmap,
            x: Int32,
            y: Int32,
            width: Int32,
            height: Int32
        ) => new RoRegion(bitmap, x, y, width, height),
    ],
    [
        "roscreen",
        (interpreter: Interpreter, dblbuffer?: BrsBoolean, width?: Int32, height?: Int32) =>
            new RoScreen(dblbuffer, width, height),
    ],
    ["roxmlelement", (interpreter: Interpreter) => new RoXMLElement()],
]);
