import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { Timespan } from "./Timespan";
import { RoSGNode, createNodeByType } from "./RoSGNode";
import { RoRegex } from "./RoRegex";
import { BrsString, BrsBoolean } from "../BrsType";
import { RoString } from "./RoString";
import { RoBoolean } from "./RoBoolean";
import { RoDouble } from "./RoDouble";
import { RoFloat } from "./RoFloat";
import { Double } from "../Double";
import { Float } from "../Float";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", () => new RoAssociativeArray([])],
    ["roarray", () => new RoArray([])],
    ["rotimespan", () => new Timespan()],
    ["rosgnode", (nodeType: BrsString) => createNodeByType(nodeType)],
    ["roregex", (expression: BrsString, flags: BrsString) => new RoRegex(expression, flags)],
    ["rostring", (literal: BrsString) => new RoString(literal)],
    ["roBoolean", (literal: BrsBoolean) => new RoBoolean(literal)],
    ["roDouble", (literal: Double) => new RoDouble(literal)],
    ["roFloat", (literal: Float) => new RoFloat(literal)],
]);
