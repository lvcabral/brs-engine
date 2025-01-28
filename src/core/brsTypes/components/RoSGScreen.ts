import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsEvent,
    BrsNodeType,
    BrsType,
    createNodeByType,
    KeyEvent,
    mGlobal,
    NodeFactory,
    RoMessagePort,
    RoSGNode,
} from "..";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { RoSGScreenEvent } from "../events/RoSGScreenEvent";
import { BlockEnd } from "../../parser/Statement";
import { Scope } from "../..";
import { Stmt } from "../../parser";

// Roku Remote Mapping
const rokuKeys: Map<number, string> = new Map([
    [0, "back"],
    [2, "up"],
    [3, "down"],
    [4, "left"],
    [5, "right"],
    [6, "OK"],
    [7, "replay"],
    [8, "rewind"],
    [9, "fastforward"],
    [10, "options"],
    [13, "play"],
]);

export class roSGScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly interpreter: Interpreter;
    private readonly keysBuffer: KeyEvent[];
    private port?: RoMessagePort;
    private sceneNode?: RoSGNode;
    private lastKey: number;

    constructor(interpreter: Interpreter) {
        super("roSGScreen");
        this.interpreter = interpreter;
        this.lastKey = -1;
        this.keysBuffer = [];

        const setPortIface = new IfSetMessagePort(this, this.getNewEvents.bind(this));
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifSGScreen: [
                this.getGlobalNode,
                this.show,
                this.close,
                this.createScene,
                this.getScene,
                setPortIface.setMessagePort,
                getPortIface.getMessagePort,
            ],
        });
    }

    equalTo(other: BrsType) {
        // RBI doesn't allow events to be compared.
        return BrsBoolean.False;
    }

    toString() {
        return "<Component: roSGScreen>";
    }

    /** Message callback to handle control keys */
    private getNewEvents() {
        const events: BrsEvent[] = [];
        this.interpreter.updateKeysBuffer(this.keysBuffer);
        const nextKey = this.keysBuffer.shift();
        if (nextKey && nextKey.key !== this.lastKey && this.sceneNode) {
            if (this.interpreter.singleKeyEvents) {
                if (nextKey.mod === 0) {
                    if (this.lastKey >= 0 && this.lastKey < 100) {
                        this.keysBuffer.unshift({ ...nextKey });
                        nextKey.key = this.lastKey + 100;
                        nextKey.mod = 100;
                    }
                } else if (nextKey.key !== this.lastKey + 100) {
                    return events;
                }
            }
            this.interpreter.lastKeyTime = this.interpreter.currKeyTime;
            this.interpreter.currKeyTime = performance.now();
            this.lastKey = nextKey.key;

            const key = new BrsString(rokuKeys.get(nextKey.key - nextKey.mod) ?? "");
            const press = BrsBoolean.from(nextKey.mod === 0);
            const hostNode = this.sceneNode;

            let handled = this.interpreter.inSubEnv((subInterpreter) => {
                subInterpreter.environment.hostNode = hostNode;
                subInterpreter.environment.setRootM(hostNode.m);
                subInterpreter.environment.setM(hostNode.m);
                let onKeyEvent = subInterpreter.getCallableFunction("onKeyEvent");
                if (!(onKeyEvent instanceof Callable) || key.value === "") {
                    return BrsBoolean.False;
                }
                try {
                    const satisfiedSignature = onKeyEvent?.getFirstSatisfiedSignature([key, press]);
                    if (satisfiedSignature) {
                        let { signature, impl } = satisfiedSignature;
                        subInterpreter.environment.define(
                            Scope.Function,
                            signature.args[0].name.text,
                            key,
                            this.interpreter.location
                        );
                        subInterpreter.environment.define(
                            Scope.Function,
                            signature.args[1].name.text,
                            press,
                            this.interpreter.location
                        );
                        impl(subInterpreter, key, press);
                    }
                } catch (err) {
                    if (!(err instanceof BlockEnd)) {
                        throw err;
                    } else if (err instanceof Stmt.ReturnValue) {
                        return err.value ?? BrsBoolean.False;
                    }
                }
                return BrsBoolean.False;
            }, this.interpreter.environment);
            if (key.value === "back" && handled instanceof BrsBoolean && !handled.toBoolean()) {
                events.push(new RoSGScreenEvent(BrsBoolean.True));
            }
        }
        return events;
    }

    /** Returns a global reference object for the SceneGraph application. */
    private getGlobalNode = new Callable("getGlobalNode", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return mGlobal ?? BrsInvalid.Instance;
        },
    });

    /** Renders the SceneGraph scene defined by the roSGScreen object on the display screen. */
    private show = new Callable("show", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            // TODO: Implement show
            return BrsBoolean.False;
        },
    });

    /** Removes the SceneGraph scene from the display screen. */
    private close = new Callable("close", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.port?.pushMessage(new RoSGScreenEvent(BrsBoolean.True));
            return Uninitialized.Instance;
        },
    });

    /** Creates the SceneGraph scene object based on the specified sceneType object. */
    private createScene = new Callable("createScene", {
        signature: {
            args: [new StdlibArgument("sceneType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, sceneType: BrsString) => {
            let returnValue: BrsType = BrsInvalid.Instance;
            if (sceneType.value === "Scene") {
                returnValue = NodeFactory.createNode(BrsNodeType.Scene) ?? BrsInvalid.Instance;
            } else {
                const typeDef = interpreter.environment.nodeDefMap.get(
                    sceneType.value.toLowerCase()
                );
                if (typeDef && typeDef.extends === "Scene") {
                    returnValue = createNodeByType(interpreter, sceneType);
                }
            }
            if (returnValue instanceof RoSGNode) {
                this.sceneNode = returnValue;
            }
            return returnValue;
        },
    });

    /** The roSGScene object associated with the screen. */
    private getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return this.sceneNode ?? BrsInvalid.Instance;
        },
    });
}
