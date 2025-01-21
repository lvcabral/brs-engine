import { BrsComponent } from "./BrsComponent";
import { ValueKind, BrsString, BrsValue, BrsBoolean, Uninitialized, BrsInvalid } from "../BrsType";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RoSGNode } from "./RoSGNode";
import { BrsType } from "..";
import { IfGetMessagePort, IfSetMessagePort } from "../interfaces/IfMessagePort";

export class roSGScreen extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly globalNode?: RoSGNode;

    constructor(interpreter: Interpreter, globalNode?: RoSGNode) {
        super("roSGScreen");
        this.globalNode = globalNode;
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
            return this.globalNode ?? BrsInvalid.Instance;
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
            // TODO: Implement close
            return Uninitialized.Instance;
        },
    });

    /** Creates the SceneGraph scene object based on the specified sceneType object. */
    private createScene = new Callable("createScene", {
        signature: {
            args: [new StdlibArgument("sceneType", ValueKind.String)],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter, sceneType: BrsString) => {
            // TODO: Implement createScene
            return BrsInvalid.Instance;
        },
    });

    /** The roSGScene object associated with the screen. */
    private getScene = new Callable("getScene", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            // TODO: Implement getScene
            return BrsInvalid.Instance;
        },
    });
}
