import { RoAssociativeArray } from "./RoAssociativeArray";
import { RoArray } from "./RoArray";
import { Timespan } from "./Timespan";
import { RoSGNode, createNodeByType } from "./RoSGNode";
import { RoRegex } from "./RoRegex";
import { BrsString } from "../BrsType";
import { RoString } from "./RoString";
import { Interpreter } from "../../interpreter";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    ["roassociativearray", (interpreter: Interpreter) => new RoAssociativeArray([])],
    ["roarray", (interpreter: Interpreter) => new RoArray([])],
    ["rotimespan", (interpreter: Interpreter) => new Timespan()],
    ["rosgnode", (interpreter: Interpreter, nodeType: BrsString) => createNodeByType(nodeType)],
    [
        "roregex",
        (interpreter: Interpreter, expression: BrsString, flags: BrsString) =>
            new RoRegex(expression, flags),
    ],
    ["rostring", (interpreter: Interpreter, literal: BrsString) => new RoString(literal)],
]);
