import { BrsType } from "..";
import { BrsInvalid } from "../BrsType";
import { Callable } from "../Callable";
import { BrsInterface } from "../BrsInterface";

export class BrsComponent {
    private methods: Map<string, Callable> = new Map();
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
        this.methods = new Map<string, Callable>();
        Object.entries(interfaces).forEach(([interfaceName, methods]) => {
            this.interfaces.set(
                interfaceName.toLowerCase(),
                new BrsInterface(interfaceName, methods)
            );

            methods.forEach((m) => this.methods.set((m.name ?? "").toLowerCase(), m));
        });
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
    }

    removeReference() {
        this.references--;
        if (this.references === 0 && !this.returnFlag) {
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

    set(index: BrsType, value: BrsType, isCaseSensitive?: boolean): BrsInvalid;
}
