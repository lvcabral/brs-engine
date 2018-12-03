import { BrsType } from "..";
import { BrsInvalid } from "../BrsType";

export interface BrsComponent {

}

/** Represents a BrightScript component that has elements that can be iterated across. */
export interface BrsIterable {
    /**
     * Returns the set of iterable elements contained in this component.
     * @returns an array of elements contained in this component.
     */
    getElements(): ReadonlyArray<BrsType>;

    /**
     * Retrieves an element from this component at the provided `index`.
     * @param index the index in this component from which to retrieve the desired element.
     * @returns the element at `index` if one exists, otherwise throws an Error.
     */
    get(index: BrsType): BrsType;

    set(index: BrsType, value: BrsType): BrsInvalid;
}