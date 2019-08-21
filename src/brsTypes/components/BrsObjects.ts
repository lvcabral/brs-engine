import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { Timespan } from "./Timespan";
import { RoSGNode, createNodeByType } from "./RoSGNode";
import { RoRegex } from "./RoRegex";
import { BrsString, BrsBoolean } from "../BrsType";
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
    ["roassociativearray", () => new RoAssociativeArray([])],
    ["roarray", () => new RoArray([])],
    ["rotimespan", () => new Timespan()],
    ["rosgnode", (nodeType: BrsString) => createNodeByType(nodeType)],
    ["roregex", (expression: BrsString, flags: BrsString) => new RoRegex(expression, flags)],
    ["rostring", (literal: BrsString) => new RoString(literal)],
    ["roboolean", (literal: BrsBoolean) => new roBoolean(literal)],
    ["rodouble", (literal: Double) => new roDouble(literal)],
    ["rofloat", (literal: Float) => new roFloat(literal)],
    ["roint", (literal: Int32) => new roInt(literal)],
]);
