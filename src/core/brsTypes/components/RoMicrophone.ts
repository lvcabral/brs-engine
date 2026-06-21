import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsType, BrsString, RoMessagePort } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { IfSetMessagePort, IfGetMessagePort } from "../interfaces/IfMessagePort";

/**
 * Mock implementation of the roMicrophone component.
 * The engine cannot access a remote/mobile microphone, so the capture methods
 * report failure ("no microphone available") to let apps degrade gracefully
 * instead of crashing. No roMicrophoneEvent is ever posted to the message port.
 */
export class RoMicrophone extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly port?: RoMessagePort;

    constructor() {
        super("roMicrophone");
        const setPortIface = new IfSetMessagePort(this);
        const getPortIface = new IfGetMessagePort(this);
        this.registerMethods({
            ifMicrophone: [this.canRecord, this.setPrompt, this.recordToFile, this.startRecording, this.stopRecording],
            ifSetMessagePort: [setPortIface.setMessagePort],
            ifGetMessagePort: [getPortIface.getMessagePort],
        });
    }

    toString(_parent?: BrsType): string {
        return "<Component: roMicrophone>";
    }

    equalTo(_other: BrsType): BrsBoolean {
        return BrsBoolean.False;
    }

    dispose() {
        this.port?.removeReference();
    }

    // ifMicrophone ---------------------------------------------------------------------

    /** Indicates whether the microphone can be opened (mock: never). */
    private readonly canRecord = new Callable("canRecord", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Sets the text displayed in the system microphone UI (mock: no-op). */
    private readonly setPrompt = new Callable("setPrompt", {
        signature: {
            args: [new StdlibArgument("prompt", ValueKind.String)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, _prompt: BrsString) => {
            return BrsInvalid.Instance;
        },
    });

    /** Records to a WAV file (mock: always fails). */
    private readonly recordToFile = new Callable("recordToFile", {
        signature: {
            args: [new StdlibArgument("wavFilePath", ValueKind.String)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, _wavFilePath: BrsString) => {
            return BrsBoolean.False;
        },
    });

    /** Opens the microphone and starts streaming events (mock: always fails). */
    private readonly startRecording = new Callable("startRecording", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });

    /** Stops recording and closes the microphone (mock: always fails). */
    private readonly stopRecording = new Callable("stopRecording", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.False;
        },
    });
}
