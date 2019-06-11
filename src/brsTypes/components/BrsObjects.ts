import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { Timespan } from "./Timespan";
import { RoRegex } from "./RoRegex";
import { BrsString } from "../BrsType";
import { RoString } from "./RoString";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", () => new RoAssociativeArray([])],
    ["roarray", () => new RoArray([])],
    ["rotimespan", () => new Timespan()],
    ["roregex", (expression: BrsString, flags: BrsString) => new RoRegex(expression, flags)],
    ["rostring", (literal: BrsString) => new RoString(literal)],
]);
