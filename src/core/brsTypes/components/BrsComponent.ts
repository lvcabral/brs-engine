import { BrsType } from "..";
import { BrsBoolean, BrsInvalid } from "../BrsType";
import { Callable } from "../Callable";
import { BrsInterface } from "../interfaces/BrsInterface";
import { BrsDevice } from "../../device/BrsDevice";

export class BrsComponent {
    protected readonly componentName: string;
    private readonly methods: Map<string, Callable> = new Map();
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

    /**
     * Determines if this component implements the specified interface.
     * @param interfaceName the name of the interface to check.
     * @returns true if the component implements the interface, false otherwise.
     */
    hasInterface(interfaceName: string) {
        return this.interfaces.has(interfaceName.toLowerCase());
    }

    /**
     * Sets a filter to limit method lookups to a specific interface.
     * @param interfaceName the name of the interface to filter by.
     */
    setFilter(interfaceName: string) {
        this.filter = interfaceName.toLowerCase();
    }

    /**
     * Registers methods for the specified interfaces.
     * @param interfaces a record mapping interface names to arrays of Callables.
     */
    protected registerMethods(interfaces: Record<string, Callable[]>) {
        for (const [interfaceName, methods] of Object.entries(interfaces)) {
            const methodNames = new Set(
                methods.filter((m) => m.name?.toLowerCase()).map((m) => m.name?.toLowerCase()!)
            );
            this.interfaces.set(interfaceName.toLowerCase(), new BrsInterface(interfaceName, methodNames));

            this.appendMethods(methods);
        }
    }

    /**
     * Given a list of methods, appends all of them to the component.
     * @param methods List of Callables to add
     */
    appendMethods(methods: Callable[]) {
        for (const m of methods) {
            this.methods.set((m.name || "").toLowerCase(), m);
        }
    }

    /**
     * Given a list of methods, overrides existing methods in the component.
     * @param methods List of Callables to override
     */
    overrideMethods(methods: Callable[]) {
        for (const m of methods) {
            if (!m.name || !this.methods.has(m.name.toLowerCase())) {
                continue;
            }
            this.methods.set(m.name.toLowerCase(), m);
        }
    }

    /**
     * Looks up a method by name, respecting any active interface filter.
     * @param index Method name to look up
     * @returns Callable if found, undefined otherwise
     */
    getMethod(index: string): Callable | undefined {
        const method = index.toLowerCase();
        if (this.filter !== "") {
            const iface = this.interfaces.get(this.filter);
            this.filter = "";
            return iface?.hasMethod(method) ? this.methods.get(method) : undefined;
        }
        return this.methods.get(method);
    }

    /**
     * Returns the current reference count for this component.
     * @returns the number of active references to this component.
     */
    getReferenceCount() {
        return this.references;
    }

    /**
     * Sets whether this component is being returned from a function.
     * @param beingReturned true if the component is being returned, false otherwise.
     */
    setReturn(beingReturned: boolean) {
        // prevent dispose when returning object created inside a function
        this.returnFlag = beingReturned;
    }

    /**
     * Increments the reference count for this component.
     */
    addReference() {
        this.references++;
        if (this.references === 1) {
            const count = BrsDevice.bscs.get(this.componentName) ?? 0;
            BrsDevice.bscs.set(this.componentName, count + 1);
        }
    }

    /**
     * Decrements the reference count for this component.
     * Disposes the component if the reference count reaches zero and it's not being returned.
     * @returns the updated reference count.
     */
    removeReference() {
        this.references--;
        if (this.references === 0 && !this.returnFlag) {
            const count = BrsDevice.bscs.get(this.componentName);
            if (count) {
                BrsDevice.bscs.set(this.componentName, count - 1);
            }
            this.dispose();
        }
        return this.references;
    }

    /**
     * Disposes of this component, releasing any resources held.
     */
    dispose() {
        // To be overridden by subclasses
    }
}

/** Represents a BrightScript component that has elements that can be accessed via index. */
export interface BrsCollection {
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
}

/** Represents a BrightScript component that has elements that can be iterated across. */
export interface BrsIterable extends BrsCollection {
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
