import { Identifier } from "../lexer";
import { BrsType, AssociativeArray } from "../brsTypes";

/** The logical region from a particular variable or function that defines where it may be accessed from. */
export enum Scope {
    /** The set of native functions that are always accessible, e.g. `RebootSystem`. */
    Global,
    /** The set of named functions accessible from a set of files compiled together. */
    Module,
    /** The set of variables (including anonymous functions) accessible *only* from within a function body. */
    Function
}

/** An error thrown when attempting to access an uninitialized variable. */
export class NotFound extends Error {
    constructor(reason: string) {
        super(reason);
    }
}

/** Holds a set of values in multiple scopes and provides access operations to them. */
export class Environment {
    /**
     * Functions that are always accessible.
     * @see Scope.Global
     */
    private global = new Map<string, BrsType>();
    /**
     * Named functions that are compiled together into a single module.
     * @see Scope.Module
     */
    private module = new Map<string, BrsType>();
    /**
     * Variables and anonymous functions accessible only within a function's body.
     * @see Scope.Function
     */
    private function = new Map<string, BrsType>();
    /** The BrightScript `m` pointer, analogous to JavaScript's `this` pointer. */
    private mPointer = new AssociativeArray([]);

    /**
     * Stores a `value` for the `name`d variable in the provided `scope`.
     * @param scope The logical region from a particular variable or function that defines where it may be accessed from
     * @param name the name of the variable to define (in the form of an `Identifier`)
     * @param value the value of the variable to define
     */
    public define(scope: Scope, name: string, value: BrsType): void {
        let destination: Map<string, BrsType>;

        switch (scope) {
            case Scope.Function:
                destination = this.function;
                break;
            case Scope.Module:
                destination = this.module;
                break;
            default:
                destination = this.global;
                break;
        }

        destination.set(name.toLowerCase(), value);
    }

    /**
     * Sets the value of the special `m` variable, which is analogous to JavaScript's `this`.
     * @param newMPointer the new value to be used for the `m` pointer
     */
    public setM(newMPointer: AssociativeArray): void {
        this.mPointer = newMPointer;
    }

    /**
     * Retrieves the current value of the special `m` variable, which is analogous to JavaScript's `this`.
     * @returns the current value used for the `m` pointer.
     */
    public getM(): AssociativeArray {
        return this.mPointer;
    }

    /**
     * Removes a variable from this environment's function scope.
     * @param name the name of the variable to remove (in the form of an `Identifier`)
     */
    public remove(name: string): void {
        this.function.delete(name.toLowerCase());
    }

    /**
     * Retrieves a variable from this environment, checking each internal scope in order of precedence.
     * @param name the name of the variable to retrieve (in the form of an `Identifier`)
     * @returns the value stored for `name` if any exist
     * @throws a `NotFound` error if no value is stored for `name`
     */
    public get(name: Identifier): BrsType {
        let lowercaseName = name.text.toLowerCase();

        // "m" always maps to the special `m` pointer
        if (lowercaseName === "m") {
            return this.mPointer;
        }

        let source = [this.function, this.module, this.global].find(scope =>
            scope.has(lowercaseName)
        );

        if (source) {
            return source.get(lowercaseName)!;
        }

        throw new NotFound(`Undefined variable '${name.text}'`);
    }

    /**
     * Determines whether or not a variable exists in this environment.
     * @param name the name of the variable to search for (in the form of an `Identifier`)
     * @param scopeFilter the set of scopes with which to limit searches for `name`
     * @returns `true` if this environment contains `name`, otherwise `false`
     */
    public has(name: Identifier, scopeFilter: Scope[] = [Scope.Global, Scope.Module, Scope.Function]): boolean {
        if (name.text.toLowerCase() === "m") {
            return true; // we always have an `m` scope of some sort!
        }

        let lowercaseName = name.text.toLowerCase();
        return scopeFilter.map(scopeName => {
            switch (scopeName) {
                case Scope.Global: return this.global;
                case Scope.Module: return this.module;
                case Scope.Function: return this.function;
            }
        }).find(scope => scope.has(lowercaseName)) != null;
    }

    /**
     * Creates a clone of the current environment, but without its function-scoped
     * values. Useful for creating sub-environments.
     *
     * The Reference BrightScript Implementation (RBI) doesn't currently create closures when
     * functions are created.  When a function is called, it has access only to:
     *
     * 1. Globally-defined functions (e.g. `RebootSystem`, `UCase`, et. al.)
     * 2. Named functions compiled together into a single "module"
     * 3. Parameters passed into the function
     * 4. The `m` pointer, defined by the way in which a function was called
     *
     * @returns a copy of this environment but with no function-scoped values.
     */
    public createSubEnvironment(): Environment {
        let newEnvironment = new Environment();
        newEnvironment.global = this.global;
        newEnvironment.module = this.module;
        newEnvironment.mPointer = this.mPointer;

        return newEnvironment;
    }
}
