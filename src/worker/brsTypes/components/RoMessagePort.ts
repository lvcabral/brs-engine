import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent } from "./RoUniversalControlEvent";
import { RoAudioPlayerEvent } from "./RoAudioPlayerEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly type = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
    private messageQueue: BrsType[];
    private callbackQueue: Function[]; // TODO: consider having the id of the connected objects
    private lastKey: number;
    private screen: boolean;
    private lastFlags: number;
    private audio: boolean;
    constructor() {
        super("roMessagePort");
        Object.freeze(this.type);
        this.registerMethods({
            ifMessagePort: [this.waitMessage, this.getMessage, this.peekMessage],
        });
        this.messageQueue = [];
        this.callbackQueue = [];
        this.lastKey = -1;
        this.screen = false;
        this.lastFlags = -1;
        this.audio = false;
    }

    enableKeys(enable: boolean) {
        this.screen = enable;
    }

    enableAudio(enable: boolean) {
        this.audio = enable;
    }

    pushMessage(object: BrsType) {
        this.messageQueue.push(object);
    }

    registerCallback(callback: Function) {
        this.callbackQueue.push(callback);
    }

    asyncCancel() {
        this.callbackQueue = [];
    }

    toString(parent?: BrsType): string {
        return "<Component: roMessagePort>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    wait(interpreter: Interpreter, ms: number) {
        if (this.screen) {
            if (ms === 0) {
                while (true) {
                    const key = Atomics.load(interpreter.sharedArray, this.type.KEY);
                    if (key !== this.lastKey) {
                        return this.newControlEvent(interpreter, key);
                    } else if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            } else {
                ms += new Date().getTime();
                while (new Date().getTime() < ms) {
                    const key = Atomics.load(interpreter.sharedArray, this.type.KEY);
                    if (key !== this.lastKey) {
                        return this.newControlEvent(interpreter, key);
                    } else if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            }
        } else if (this.audio) {
            if (ms === 0) {
                while (true) {
                    const flags = Atomics.load(interpreter.sharedArray, this.type.SND);
                    if (flags !== this.lastFlags) {
                        this.lastFlags = flags;
                        if (this.lastFlags >= 0) {
                            return new RoAudioPlayerEvent(
                                this.lastFlags,
                                Atomics.load(interpreter.sharedArray, this.type.IDX)
                            );
                        }
                    } else if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            } else {
                ms += new Date().getTime();
                while (new Date().getTime() < ms) {
                    const flags = Atomics.load(interpreter.sharedArray, this.type.SND);
                    if (flags !== this.lastFlags) {
                        this.lastFlags = flags;
                        if (this.lastFlags >= 0) {
                            return new RoAudioPlayerEvent(
                                this.lastFlags,
                                Atomics.load(interpreter.sharedArray, this.type.IDX)
                            );
                        }
                    } else if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            }
        } else {
            if (this.messageQueue.length > 0) {
                let message = this.messageQueue.shift();
                if (message) {
                    return message;
                }
            } else if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue.shift();
                if (callback) {
                    return callback();
                }
            }
            if (ms === 0) {
                postMessage(
                    "warning,[roMessagePort] No message in the queue, engine will loop forever!"
                );
                while (true) {
                    // Loop forever
                    if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            } else {
                postMessage("warning,[roMessagePort] No message in the queue!");
                ms += new Date().getTime();
                while (new Date().getTime() < ms) {
                    //wait the timeout time
                    if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            }
        }
        return BrsInvalid.Instance;
    }

    newControlEvent(interpreter: Interpreter, key: number): RoUniversalControlEvent {
        this.lastKey = key;
        let mod = Atomics.load(interpreter.sharedArray, this.type.MOD);
        interpreter.lastKeyTime = interpreter.currKeyTime;
        interpreter.currKeyTime = Date.now();
        return new RoUniversalControlEvent("WD:0", key, mod);
    }

    /** Waits until an event object is available or timeout milliseconds have passed. */
    private waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, timeout: Int32) => {
            return this.wait(interpreter, timeout.getValue());
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            if (this.screen) {
                const key = Atomics.load(interpreter.sharedArray, this.type.KEY);
                if (key !== this.lastKey) {
                    return this.newControlEvent(interpreter, key);
                }
            } else if (this.audio) {
                const flags = Atomics.load(interpreter.sharedArray, this.type.SND);
                if (flags !== this.lastFlags) {
                    this.lastFlags = flags;
                    if (this.lastFlags >= 0) {
                        return new RoAudioPlayerEvent(
                            this.lastFlags,
                            Atomics.load(interpreter.sharedArray, this.type.IDX)
                        );
                    }
                }
            } else if (this.messageQueue.length > 0) {
                let message = this.messageQueue.shift();
                if (message) {
                    return message;
                }
            } else if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue.shift();
                if (callback) {
                    return callback();
                }
            }
            return BrsInvalid.Instance;
        },
    });

    /** Similar to GetMessage() but the returned object (if not invalid) remains in the message queue. */
    private peekMessage = new Callable("peekMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            if (this.screen) {
                const key = Atomics.load(interpreter.sharedArray, this.type.KEY);
                if (key !== this.lastKey) {
                    const mod = Atomics.load(interpreter.sharedArray, this.type.MOD);
                    return new RoUniversalControlEvent("WD:0", key, mod);
                }
            } else if (this.audio) {
                const flags = Atomics.load(interpreter.sharedArray, this.type.SND);
                if (flags !== this.lastFlags && flags >= 0) {
                    const idx = Atomics.load(interpreter.sharedArray, this.type.IDX);
                    return new RoAudioPlayerEvent(flags, idx);
                }
            } else if (this.messageQueue.length > 0) {
                let message = this.messageQueue[0];
                if (message) {
                    return message;
                }
            } else if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue[0];
                if (callback) {
                    return callback();
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
