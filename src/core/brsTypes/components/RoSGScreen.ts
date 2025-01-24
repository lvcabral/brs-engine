import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import {
    BrsNodeType,
    BrsType,
    createNodeByType,
    mGlobal,
    NodeFactory,
    RoMessagePort,
    RoSGNode,
} from "..";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";
import { RoSGScreenEvent } from "./RoSGScreenEvent";

export class roSGScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private port?: RoMessagePort;
    private sceneNode?: RoSGNode;
    constructor(_: Interpreter) {
        super("roSGScreen");
        const setPortIface = new IfSetMessagePort(this);
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
        impl: async (interpreter: Interpreter, sceneType: BrsString) => {
            let returnValue: BrsType = BrsInvalid.Instance;
            if (sceneType.value === "Scene") {
                returnValue = NodeFactory.createNode(BrsNodeType.Scene) ?? BrsInvalid.Instance;
            } else {
                const typeDef = interpreter.environment.nodeDefMap.get(
                    sceneType.value.toLowerCase()
                );
                if (typeDef && typeDef.extends === "Scene") {
                    returnValue = await createNodeByType(interpreter, sceneType);
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
