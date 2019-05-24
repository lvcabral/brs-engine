import { AssociativeArray } from "./AssociativeArray";
import { BrsArray } from "./BrsArray";
import { Timespan } from "./Timespan";
import { Regex } from "./Regex";
import { BrsString } from "../BrsType";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", () => new AssociativeArray([])],
    ["roarray", () => new BrsArray([])],
    ["rotimespan", () => new Timespan()],
    ["roregex", (expression: BrsString, flags: BrsString) => new Regex(expression, flags)],
]);
