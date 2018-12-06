import { AssociativeArray } from "./AssociativeArray";
import { BrsString } from "../BrsType";

/** Map containing a list of brightscript components that can be created. */
export const BrsObjects = new Map<string, Function>(
    [
        [ "roassociativearray", () => new AssociativeArray([]) ]
    ]
);
