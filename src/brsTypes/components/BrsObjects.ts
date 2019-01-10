import { AssociativeArray } from "./AssociativeArray";
import { BrsArray } from "./BrsArray";
import { Timespan } from "./Timespan";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>([
    [ "roassociativearray", () => new AssociativeArray([]) ],
    [ "roarray", () => new BrsArray([]) ],
    [ "rotimespan", () => new Timespan() ]
]);
