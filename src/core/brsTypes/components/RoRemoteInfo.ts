import { BrsValue, ValueKind, BrsString, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, Int32 } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { RemoteControl } from "../../common";
import { BrsDevice } from "../../device/BrsDevice";

export class RoRemoteInfo extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;

    constructor() {
        super("roRemoteInfo");
        this.registerMethods({
            ifRemoteInfo: [this.getModel, this.isAwake, this.hasFeature],
        });
    }

    toString(parent?: BrsType): string {
        return "<Component: roRemoteInfo>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    /** Returns the model number of the specified Roku remote control. */
    private readonly getModel = new Callable("getModel", {
        signature: {
            args: [new StdlibArgument("remoteIndex", ValueKind.Int32)],
            returns: ValueKind.Int32,
        },
        impl: (interpreter: Interpreter, remoteIndex: Int32) => {
            const remote = getRemote(interpreter, remoteIndex.getValue());
            return new Int32(remote.model);
        },
    });

    /** Checks whether the specified Roku remote control is awake. */
    private readonly isAwake = new Callable("isAwake", {
        signature: {
            args: [new StdlibArgument("remoteIndex", ValueKind.Int32)],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, remoteIndex: Int32) => {
            const remote = getRemote(interpreter, remoteIndex.getValue());
            return BrsBoolean.from(remote.model > 0);
        },
    });

    /** Checks if the current device/firmware supports the passed in feature string. */
    private readonly hasFeature = new Callable("hasFeature", {
        signature: {
            args: [
                new StdlibArgument("feature", ValueKind.String),
                new StdlibArgument("remoteIndex", ValueKind.Int32),
            ],
            returns: ValueKind.Boolean,
        },
        impl: (interpreter: Interpreter, feature: BrsString, remoteIndex: Int32) => {
            const features = ["muteswitch"]; // MuteSwitch feature always returns true in Roku
            const remote = getRemote(interpreter, remoteIndex.getValue());
            if (remote.features.length) {
                features.push(...remote.features);
            }
            return BrsBoolean.from(features.includes(feature.value.toLowerCase()));
        },
    });
}

function getRemote(_: Interpreter, index: number): RemoteControl {
    const remotes = BrsDevice.deviceInfo.get("remoteControls");
    if (remotes instanceof Array && remotes.length && index < remotes.length) {
        if (index < 0) {
            index = BrsDevice.lastRemote;
        }
        return remotes[index];
    }
    return { model: 0, features: ["wifi"] };
}
