import { BrsType } from "..";

export interface BrsComponent {

}

/** Represents a BrightScript component that has elements that can be iterated across. */
export interface BrsIterable {
    /** Returns the set of iterable elements contained in this component. */
    getElements(): ReadonlyArray<BrsType>;
}