import { BrsComponent, BrsType } from "./brsTypes";
import { AppPayload, TaskPayload } from "./common";
import { Interpreter } from "./interpreter";

export type BrsExtensionFactory = () => BrsExtension;

const registeredFactories = new Map<string, BrsExtensionFactory>();

/**
 * Contract for extensions that can hook into the interpreter lifecycle.
 */
export interface BrsExtension {
    name: string;
    onInit?(interpreter: Interpreter): void;
    onBeforeExecute?(interpreter: Interpreter, payload: AppPayload | TaskPayload): void | Promise<void>;
    updateSourceMap?(sourceMap: Map<string, string>): void;
    tick?(interpreter: Interpreter): void;
    execTask?(interpreter: Interpreter, payload: TaskPayload): void;
    // Add hooks as needed
}

/**
 * Registers a factory that will be invoked whenever a new interpreter is created.
 * The same extension name will overwrite previous registrations.
 */
export function registerExtension(factory: BrsExtensionFactory) {
    const firstInstance = factory();
    const pool: BrsExtension[] = [firstInstance];
    registeredFactories.set(firstInstance.name, () => pool.pop() ?? factory());
}

/** Clear all registered extension factories. Primarily used for tests. */
export function clearExtensions() {
    registeredFactories.clear();
}

/**
 * Instantiates the registered extensions so they can be attached to a new interpreter.
 */
export function instantiateExtensions(): BrsExtension[] {
    const extensions: BrsExtension[] = [];
    registeredFactories.forEach((factory) => {
        extensions.push(factory());
    });
    return extensions;
}

/**
 * Minimal contract exposed by SceneGraph nodes so the core interpreter can
 * reason about them without importing the concrete implementation provided by
 * the brs-scenegraph extension.
 */
export interface ISGNode extends BrsComponent {
    /** SceneGraph subtype, e.g. "Group", "Label", "Scene". */
    readonly nodeSubtype: string;
    /** Location information for the node, useful for debugging and error reporting. */
    location?: string;
    /** Creates a deep copy of this SceneGraph node and its children. */
    deepCopy(): BrsType;
}

export function isSceneGraphNode(value: unknown): value is ISGNode {
    return Boolean(value && typeof value === "object" && "nodeSubtype" in (value as ISGNode));
}
