import { bscs } from "../..";
import { BrsType } from "..";
import { BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable } from "../Callable";
import { BrsInterface } from "../interfaces/BrsInterface";

export class BrsComponent {
    private readonly methods: Map<string, Callable> = new Map();
    private readonly componentName: string;
    private filter: string = "";
    protected references: number;
    protected returnFlag: boolean;

    readonly interfaces = new Map<string, BrsInterface>();

    constructor(name: string) {
        this.componentName = name;
        this.references = 0;
        this.returnFlag = false;
    }

    /**
     * Returns the name of the component, used to create instances via `createObject`.
     * @returns the name of this component.
     */
    getComponentName(): string {
        return this.componentName;
    }

    hasInterface(interfaceName: string) {
        return this.interfaces.has(interfaceName.toLowerCase());
    }

    setFilter(interfaceName: string) {
        this.filter = interfaceName.toLowerCase();
    }

    protected registerMethods(interfaces: Record<string, Callable[]>) {
        Object.entries(interfaces).forEach(([interfaceName, methods]) => {
            const methodNames = new Set(
                methods.filter((m) => m.name?.toLowerCase()).map((m) => m.name?.toLowerCase()!)
            );
            this.interfaces.set(
                interfaceName.toLowerCase(),
                new BrsInterface(interfaceName, methodNames)
            );

            this.appendMethods(methods);
        });
    }

    /** Given a list of methods, appends all of them to the component. */
    appendMethods(methods: Callable[]) {
        methods.forEach((m) => this.methods.set((m.name || "").toLowerCase(), m));
    }

    getMethod(index: string): Callable | undefined {
        const method = index.toLowerCase();
        if (this.filter !== "") {
            const iface = this.interfaces.get(this.filter);
            this.filter = "";
            return iface?.hasMethod(method) ? this.methods.get(method) : undefined;
        }
        return this.methods.get(method);
    }
    getReferenceCount() {
        return this.references;
    }

    setReturn(beingReturned: boolean) {
        // prevent dispose when returning object created inside a function
        this.returnFlag = beingReturned;
    }

    addReference() {
        this.references++;
        if (this.references === 1) {
            const count = bscs.get(this.componentName) ?? 0;
            bscs.set(this.componentName, count + 1);
        }
    }

    removeReference() {
        this.references--;
        if (this.references === 0 && !this.returnFlag) {
            const count = bscs.get(this.componentName);
            if (count) {
                bscs.set(this.componentName, count - 1);
            }
            this.dispose();
        }
    }

    dispose() {
        // To be overridden by subclasses
    }
}

/** Represents a BrightScript component that has elements that can be iterated across. */
export interface BrsIterable {
    /**
     * Returns the set of iterable elements contained in this component.
     * @returns an array of elements contained in this component.
     */
    getElements(): readonly BrsType[];

    /**
     * Retrieves an element from this component at the provided `index`.
     * @param index the index in this component from which to retrieve the desired element.
     * @param isCaseSensitive determinate whether operation of getting should be case sensitive or not.
     * @returns the element at `index` if one exists, otherwise throws an Error.
     */
    get(index: BrsType, isCaseSensitive?: boolean): BrsType;

    /**
     * Sets the element at the provided `index` to the provided `value`.
     * @param index the index in this component at which to set the provided `value`.
     * @param value the value to update at the provided `index`.
     * @param isCaseSensitive determinate whether operation of setting should be case sensitive or not.
     */
    set(index: BrsType, value: BrsType, isCaseSensitive?: boolean): BrsInvalid;

    /**
     * Determines if the iteration index is at the end of the iterable component.
     * @returns `true` if there are more elements to iterate, otherwise `false`.
     */
    hasNext(): BrsBoolean;

    /**
     * Retrieves the next element in the iteration sequence.
     * @returns the next element in the iteration sequence.
     */
    getNext(): BrsType;

    /**
     * Resets the iteration sequence to the beginning of the iterable component.
     */
    resetNext(): void;

    /**
     * Update the iteration index to the next element in the iteration sequence.
     */
    updateNext(): void;
}
