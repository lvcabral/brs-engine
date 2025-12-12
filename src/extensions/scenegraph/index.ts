/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
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
    ThreadUpdate,
    BrsInvalid,
    BrsObjects,
    BrsString,
} from "brs-engine";
import { getComponentDefinitionMap, setupInterpreterWithSubEnvs } from "./parser/ComponentDefinition";
import { sgRoot } from "./SGRoot";
import { Task } from "./nodes/Task";
import { initializeTask, createNodeByType } from "./factory/SGNodeFactory";
import { RoSGScreen } from "./components/RoSGScreen";
import packageInfo from "../../../packages/scenegraph/package.json";

export * from "./SGRoot";
export * from "./components/RoSGNode";
export * from "./components/RoSGScreen";
export * from "./events/RoSGNodeEvent";
export * from "./events/RoSGScreenEvent";
export * from "./factory/SGNodeFactory";
export * from "./factory/serialization";
export * from "./parser/ComponentDefinition";
export * from "./parser/ComponentScopeResolver";
export * from "./nodes";

export class BrightScriptExtension implements BrsExtension {
    name = "SceneGraph";
    version = packageInfo.version;

    onInit() {
        // Register SceneGraph components with BrsObjects so they can be created with CreateObject()
        BrsObjects.set("rosgscreen", () => new RoSGScreen(), 0);
        BrsObjects.set(
            "rosgnode",
            (interpreter: Interpreter, nodeType: BrsString) => createNodeByType(nodeType.value, interpreter),
            1
        );
    }

    async onBeforeExecute(interpreter: Interpreter, payload: AppPayload) {
        // Look for SceneGraph components
        try {
            const components = await getComponentDefinitionMap(BrsDevice.fileSystem, []);
            if (components.size > 0) {
                await setupInterpreterWithSubEnvs(interpreter, components, payload.manifest, interpreter.options);
                sgRoot.setNodeDefMap(components);
            } else {
                const componentsDirExists = BrsDevice.fileSystem.existsSync("pkg:/components");
                if (componentsDirExists) {
                    postMessage(`warning,No SceneGraph components found!`);
                }
            }
        } catch (err: any) {
            if (err instanceof BrsError) {
                interpreter.addError(err);
            } else {
                postMessage(`error,Failed to load SceneGraph components: ${err.message}`);
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
            sgRoot.tasks[0]?.updateTask();
        }
    }

    execTask(interpreter: Interpreter, payload: TaskPayload) {
        const taskData = payload.taskData;
        const taskNode = initializeTask(interpreter, taskData);
        const functionName = taskData.m?.top?.functionname;
        if (!(taskNode instanceof Task) || !functionName) {
            return;
        }
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
                        console.debug("[Worker] Task function called: ", taskData.name, functionName);
                        funcToCall.call(subInterpreter);
                        console.debug("[Worker] Task function finished: ", taskData.name, functionName);
                        const update: ThreadUpdate = {
                            id: taskNode.id,
                            type: "task",
                            field: "control",
                            value: "stop",
                        };
                        postMessage(update);
                        taskData.state = TaskState.STOP;
                        postMessage(taskData);
                    } else {
                        subInterpreter.addError(
                            new BrsError(`Cannot found the Task function '${functionName}'`, subInterpreter.location)
                        );
                    }
                    return BrsInvalid.Instance;
                }, taskEnv);
            } catch (err: any) {
                if (err instanceof Stmt.ReturnValue) {
                    // ignore return value from Task, closing the Task
                } else if (err instanceof BrsError) {
                    const backTrace = interpreter.formatBacktrace(err.location, true, err.backTrace);
                    const error = new Error(`${err.format()}\nBackTrace:\n${backTrace}`);
                    (error as any).cause = err;
                    throw error;
                } else {
                    throw err;
                }
            }
        }
    }
}
