import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { RoDateTime } from "./RoDateTime";
import { Timespan } from "./Timespan";
import { RoSGNode, createNodeByType } from "./RoSGNode";
import { RoRegex } from "./RoRegex";
import { BrsString, BrsBoolean } from "../BrsType";
import { RoString } from "./RoString";
import { RoBitmap } from "./RoBitmap";
import { RoScreen } from "./RoScreen";
import { Int32 } from "../Int32";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", () => new RoAssociativeArray([])],
    ["roarray", () => new RoArray([])],
    ["rodatetime", () => new RoDateTime()],
    ["rotimespan", () => new Timespan()],
    ["rosgnode", (nodeType: BrsString) => createNodeByType(nodeType)],
    ["roregex", (expression: BrsString, flags: BrsString) => new RoRegex(expression, flags)],
    ["rostring", (literal: BrsString) => new RoString(literal)],
    ["robitmap", (fileUrl: BrsString) => new RoBitmap(fileUrl)],
    [
        "roscreen",
        (dblbuffer?: BrsBoolean, width?: Int32, height?: Int32) =>
            new RoScreen(dblbuffer, width, height),
    ],
]);
