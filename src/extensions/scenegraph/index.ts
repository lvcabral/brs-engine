/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
    Interpreter,
    BrsExtension,
    AppPayload,
    TaskPayload,
    BrsDevice,
    BrsError,
    Stmt,
    Callable,
    TaskState,
    BrsInvalid,
    BrsObjects,
    BrsString,
    RuntimeError,
    RoMessagePort,
} from "brs-engine";
import {
    getComponentDefinitionMap,
    setupInterpreterWithSubEnvs,
    ComponentDefinition,
    ComponentNode,
} from "./parser/ComponentDefinition";
import { loadComponentLibrary } from "./parser/ComponentLibrary";
import { sgRoot } from "./SGRoot";
import { Task } from "./nodes/Task";
import { initializeTask, createNode, updateTypeDefHierarchy, getNodeType } from "./factory/NodeFactory";
import { RoSGScreen } from "./components/RoSGScreen";
import { getRenderThreadQueue } from "./components/RoRenderThreadQueue";
import packageInfo from "../../../packages/scenegraph/package.json";

export * from "./SGRoot";
export * from "./SGUtil";
export * from "./components/RoSGNode";
export * from "./components/RoSGScreen";
export * from "./components/RoRenderThreadQueue";
export * from "./events/RoSGNodeEvent";
export * from "./events/RoSGScreenEvent";
export * from "./factory/NodeFactory";
export * from "./factory/Serializer";
export * from "./parser/ComponentDefinition";
export * from "./parser/ComponentScopeResolver";
export * from "./nodes";

export class BrightScriptExtension implements BrsExtension {
    readonly name = "SceneGraph";
    readonly version = packageInfo.version;

    onInit() {
        // Register SceneGraph components with BrsObjects so they can be created with CreateObject()
        BrsObjects.set("roSGScreen", () => new RoSGScreen(), 0);
        BrsObjects.set(
            "roSGNode",
            (interpreter: Interpreter, type: BrsString) => createNode(type.getValue(), interpreter),
            1
        );
        // Re-register roMessagePort to handle the specific case of ports created in the Main thread
        BrsObjects.set("roMessagePort", (interpreter: Interpreter) => this.createMessagePort(interpreter), 0);
        // roRenderThreadQueue (OS 15) is a per-thread singleton component created via CreateObject().
        BrsObjects.set("roRenderThreadQueue", () => getRenderThreadQueue(), 0);
    }

    private createMessagePort(interpreter?: Interpreter): RoMessagePort {
        const port = new RoMessagePort();
        if (interpreter && !sgRoot.inTaskThread()) {
            // All ports created in Main thread are registered to the screen
            if (sgRoot.screen) {
                sgRoot.screen.registerPort(port);
            } else {
                sgRoot.addPendingPort(port);
            }
        }
        return port;
    }

    async onBeforeExecute(interpreter: Interpreter, payload: AppPayload) {
        // Look for SceneGraph components
        try {
            const components = getComponentDefinitionMap(BrsDevice.fileSystem, []);
            if (components.size > 0) {
                setupInterpreterWithSubEnvs(interpreter, components, payload.manifest);
                sgRoot.setInterpreter(interpreter);
                sgRoot.setNodeDefMap(components);
                for (const [componentName, componentDef] of components.entries()) {
                    updateTypeDefHierarchy(componentDef);
                    BrsDevice.addNodeStat(getNodeType(componentName));
                }
                // Pre-load component libraries declared via <ComponentLibrary> elements so their
                // namespaced components (libraryId:ComponentName) resolve before the app runs.
                // Libraries created at runtime are loaded lazily by the ComponentLibrary node.
                this.loadComponentLibraries(components);
            } else {
                const componentsDirExists = BrsDevice.fileSystem.existsSync("pkg:/components");
                if (componentsDirExists) {
                    BrsDevice.stderr.write(`warning,[sg] No SceneGraph components found!`);
                }
            }
        } catch (err: any) {
            if (err instanceof BrsError) {
                interpreter.addError(err);
            } else {
                BrsDevice.stderr.write(`error,[sg] Failed to load SceneGraph components: ${err.message}`);
            }
        }
    }

    /**
     * Scans parsed component definitions for `<ComponentLibrary>` declarations and loads
     * each unique library so its components become available with a namespace prefix.
     * @param components Map of the app's parsed component definitions
     */
    private loadComponentLibraries(components: Map<string, ComponentDefinition>) {
        const declarations = new Map<string, { id: string; uri: string }>(); // lowercase id -> declaration
        const collect = (nodes: ComponentNode[]) => {
            for (const node of nodes) {
                if (node.name.toLowerCase() === "componentlibrary") {
                    const id = node.fields?.id?.trim();
                    const uri = node.fields?.uri?.trim();
                    // Only pre-load libraries that declare a static uri in XML; libraries whose
                    // uri is assigned at runtime are loaded lazily by the ComponentLibrary node.
                    if (id && uri && !declarations.has(id.toLowerCase())) {
                        declarations.set(id.toLowerCase(), { id, uri });
                        sgRoot.setLibraryStatus(id, "none");
                    }
                }
                if (node.children.length > 0) {
                    collect(node.children);
                }
            }
        };
        for (const component of components.values()) {
            collect(component.children);
        }
        if (declarations.size > 0) {
            BrsDevice.stdout.write(
                `debug,[sg] Found ${declarations.size} ComponentLibrary declaration(s): ${Array.from(
                    declarations.values()
                )
                    .map((d) => `${d.id}=${d.uri}`)
                    .join(", ")}`
            );
        }
        for (const { id, uri } of declarations.values()) {
            loadComponentLibrary(id, uri);
        }
    }

    updateSourceMap(sourceMap: Map<string, string>): void {
        if (!sgRoot.nodeDefMap?.size) {
            return;
        }
        const components = sgRoot.nodeDefMap;
        for (const component of components.values()) {
            for (const script of component.scripts) {
                const sourcePath = script.uri ?? script.xmlPath;
                if (sourcePath && script.content?.length) {
                    sourceMap.set(sourcePath, script.content);
                }
            }
        }
    }

    tick(_: Interpreter) {
        if (sgRoot.inTaskThread()) {
            const task = sgRoot.getCurrentThreadTask();
            task?.processThreadUpdate();
        }
    }

    execTask(interpreter: Interpreter, payload: TaskPayload) {
        const taskData = payload.taskData;
        const taskNode = initializeTask(interpreter, taskData);
        const functionName = taskData.m?.top?.functionname;
        if (!(taskNode instanceof Task) || !functionName) {
            return;
        }
        BrsDevice.stdout.write(`debug,[sg] Calling Task in new Worker: ${taskData.name} ${functionName}`);
        if (taskData.buffer) {
            taskNode.setTaskBuffer(taskData.buffer);
        }
        if (taskData.directToTask) {
            // Phase 3a: render thread writes rendezvous responses directly into this buffer.
            taskNode.setDirectBuffer(taskData.directToTask);
        }
        const typeDef = sgRoot.nodeDefMap.get(taskNode.nodeSubtype.toLowerCase());
        const taskEnv = typeDef?.environment;
        if (taskEnv) {
            try {
                const mPointer = taskNode.m;
                interpreter.inSubEnv((subInterpreter: Interpreter) => {
                    const funcToCall = subInterpreter.getCallableFunction(functionName);
                    subInterpreter.environment.hostNode = taskNode;
                    subInterpreter.environment.setM(mPointer);
                    subInterpreter.environment.setRootM(mPointer);
                    if (funcToCall instanceof Callable) {
                        BrsDevice.stdout.write(
                            `debug,[sg] Task function called: ${taskData.name} ${functionName} active: ${taskNode.active}`
                        );
                        const funcLoc = funcToCall.getLocation() ?? interpreter.location;
                        interpreter.addToStack({
                            functionName: functionName,
                            functionLocation: funcLoc,
                            callLocation: interpreter.location,
                            signature: funcToCall.signatures[0].signature,
                        });
                        taskNode.started = true;
                        funcToCall.call(subInterpreter);
                        BrsDevice.stdout.write(
                            `debug,[sg] Task function finished: ${taskData.name} ${functionName} active: ${taskNode.active}`
                        );
                        taskNode.stopTask();
                        taskData.state = TaskState.STOP;
                        postMessage(taskData);
                    } else {
                        BrsDevice.stderr.write(`warning,[sg] Warning: Task function '${functionName}' not found!`);
                    }
                    return BrsInvalid.Instance;
                }, taskEnv);
            } catch (err: any) {
                if (err instanceof Stmt.ReturnValue) {
                    // ignore return value from Task function, closing the Task
                    BrsDevice.stdout.write(
                        `debug,[sg] Returned from Task function: ${taskData.name} ${functionName} ${err.value ?? ""}`
                    );
                    taskNode.stopTask();
                    taskData.state = TaskState.STOP;
                    postMessage(taskData);
                    return;
                } else if (err instanceof RuntimeError) {
                    interpreter.checkCrashDebug(err);
                }
                throw err;
            }
        }
    }
}
