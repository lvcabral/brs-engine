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
} from "brs-engine";
import { getComponentDefinitionMap, setupInterpreterWithSubEnvs } from "./parser/ComponentDefinition";
import { sgRoot } from "./SGRoot";
import { Task } from "./nodes/Task";
import { initializeTask, createNodeByType, updateTypeDefHierarchy, getNodeType } from "./factory/NodeFactory";
import { RoSGScreen } from "./components/RoSGScreen";
import packageInfo from "../../../packages/scenegraph/package.json";

export * from "./SGRoot";
export * from "./components/RoSGNode";
export * from "./components/RoSGScreen";
export * from "./events/RoSGNodeEvent";
export * from "./events/RoSGScreenEvent";
export * from "./factory/NodeFactory";
export * from "./factory/Serializer";
export * from "./parser/ComponentDefinition";
export * from "./parser/ComponentScopeResolver";
export * from "./nodes";

export class BrightScriptExtension implements BrsExtension {
    name = "SceneGraph";
    version = packageInfo.version;

    onInit() {
        // Register SceneGraph components with BrsObjects so they can be created with CreateObject()
        BrsObjects.set("roSGScreen", () => new RoSGScreen(), 0);
        BrsObjects.set(
            "roSGNode",
            (interpreter: Interpreter, nodeType: BrsString) => createNodeByType(nodeType.getValue(), interpreter),
            1
        );
    }

    async onBeforeExecute(interpreter: Interpreter, payload: AppPayload) {
        // Look for SceneGraph components
        try {
            const components = await getComponentDefinitionMap(BrsDevice.fileSystem, []);
            if (components.size > 0) {
                await setupInterpreterWithSubEnvs(interpreter, components, payload.manifest, interpreter.options);
                sgRoot.setInterpreter(interpreter);
                sgRoot.setNodeDefMap(components);
                for (const [componentName, componentDef] of components.entries()) {
                    updateTypeDefHierarchy(componentDef);
                    BrsDevice.addNodeStat(getNodeType(componentName));
                }
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
            const task = sgRoot.getThreadTask(sgRoot.threadId);
            task?.updateTask();
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
