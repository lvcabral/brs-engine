import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoDeviceInfo } from "./RoDeviceInfo";
import { RoArray } from "./RoArray";
import { RoList } from "./RoList";
import { RoDateTime } from "./RoDateTime";
import { Timespan } from "./Timespan";
import { createNodeByType } from "./RoSGNode";
import { RoRegex } from "./RoRegex";
import { RoXMLElement } from "./RoXMLElement";
import { BrsString, BrsBoolean } from "../BrsType";
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
import { Interpreter } from "../../interpreter";
import { roInvalid } from "./RoInvalid";
import { BrsComponent } from "./BrsComponent";
import { RoAppInfo } from "./RoAppInfo";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", (_: Interpreter) => new RoAssociativeArray([])],
    ["roarray", (_: Interpreter) => new RoArray([])],
    ["rolist", (_: Interpreter) => new RoList([])],
    ["rodatetime", (_: Interpreter) => new RoDateTime()],
    ["rotimespan", (_: Interpreter) => new Timespan()],
    ["rodeviceinfo", (_: Interpreter) => new RoDeviceInfo()],
    [
        "rosgnode",
        (interpreter: Interpreter, nodeType: BrsString) => createNodeByType(interpreter, nodeType),
    ],
    [
        "roregex",
        (_: Interpreter, expression: BrsString, flags: BrsString) => new RoRegex(expression, flags),
    ],
    ["roxmlelement", (_: Interpreter) => new RoXMLElement()],
    ["rostring", (_: Interpreter) => new RoString()],
    ["roboolean", (_: Interpreter, literal: BrsBoolean) => new roBoolean(literal)],
    ["rodouble", (_: Interpreter, literal: Double) => new roDouble(literal)],
    ["rofloat", (_: Interpreter, literal: Float) => new roFloat(literal)],
    ["roint", (_: Interpreter, literal: Int32) => new roInt(literal)],
    ["rolonginteger", (_: Interpreter, literal: Int64) => new roLongInteger(literal)],
    ["roappinfo", (_: Interpreter) => new RoAppInfo()],
    ["roinvalid", (_: Interpreter) => new roInvalid()],
]);

/**
 * Lets another software using BRS as a library to add/overwrite an implementation of a BrsObject.
 *
 * This is useful, for example, if another piece of software wanted to implement video playback or Draw2d functionality.
 *
 * In each element of the objectList param, it is pair:
 * [name of the BrsObject (e.g. "roScreen", etc.), function (interpreter, ...additionalArgs) that returns a new object]
 *
 * @example
 *
 * extendBrsObjects([
 *   ["roScreen", (_interpreter) => {return new roScreen();}]
 * ])
 *
 * @param objectList array of pairs: [name, constructor function]
 */
export function extendBrsObjects(objectList: [string, () => BrsComponent][]): void {
    objectList.forEach(([name, ctor]) => {
        BrsObjects.set(name.toLowerCase(), ctor);
    });
}
