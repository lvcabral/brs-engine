import { RoAssociativeArray, BrsString } from "../brsTypes";
import { mockComponent } from "./mockComponent";
import { RunInScope } from "./RunInScope";

export const _brs_ = new RoAssociativeArray([
    { name: new BrsString("mockComponent"), value: mockComponent },
    { name: new BrsString("runInScope"), value: RunInScope },
]);
