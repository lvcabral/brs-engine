import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent, KeyEvent } from "./RoUniversalControlEvent";
import { RoAudioPlayerEvent } from "./RoAudioPlayerEvent";
import { RoVideoPlayerEvent } from "./RoVideoPlayerEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType } from "../../../api/enums";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private messageQueue: BrsType[];
    private callbackQueue: Function[]; // TODO: consider having the id of the connected objects
    private keysQueue: KeyEvent[];
    private lastKey: number;
    private screen: boolean;
    private audioFlags: number;
    private videoFlags: number;
    private audio: boolean;
    private video: boolean;
    constructor() {
        super("roMessagePort");
        this.registerMethods({
            ifMessagePort: [this.waitMessage, this.getMessage, this.peekMessage],
        });
        this.messageQueue = [];
        this.callbackQueue = [];
        this.keysQueue = [];
        this.lastKey = -1;
        this.screen = false;
        this.audioFlags = -1;
        this.videoFlags = -1;
        this.audio = false;
        this.video = false;
    }

    enableKeys(enable: boolean) {
        this.screen = enable;
    }

    enableAudio(enable: boolean) {
        this.audio = enable;
    }

    enableVideo(enable: boolean) {
        this.video = enable;
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
        const loop = ms === 0;
        ms += performance.now();
        if (this.screen || this.audio || this.video) {
            while (loop || performance.now() < ms) {
                const newEvent = this.getEvent(interpreter);
                if (newEvent instanceof BrsComponent) {
                    return newEvent;
                } else if (interpreter.checkBreakCommand()) {
                    return BrsInvalid.Instance;
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
                ms += performance.now();
                while (performance.now() < ms) {
                    //wait the timeout time
                    if (interpreter.checkBreakCommand()) {
                        return BrsInvalid.Instance;
                    }
                }
            }
        }
        return BrsInvalid.Instance;
    }

    getEvent(interpreter: Interpreter) {
        if (this.screen) {
            this.updateKeysQueue(interpreter);
            const ctrlEvent = this.newControlEvent(interpreter);
            if (ctrlEvent instanceof RoUniversalControlEvent) {
                return ctrlEvent;
            }
        }
        if (this.audio) {
            const audioEvent = this.newAudioEvent(interpreter);
            if (audioEvent instanceof RoAudioPlayerEvent) {
                return audioEvent;
            }
        }
        if (this.video) {
            const videoEvent = this.newVideoEvent(interpreter);
            if (videoEvent instanceof RoVideoPlayerEvent) {
                return videoEvent;
            }
        }
        return BrsInvalid.Instance;
    }

    updateKeysQueue(interpreter: Interpreter) {
        const key = Atomics.load(interpreter.sharedArray, DataType.KEY);
        if (this.keysQueue.length === 0 || key !== this.keysQueue.at(-1)?.key) {
            let mod = Atomics.load(interpreter.sharedArray, DataType.MOD);
            this.keysQueue.push({ key: key, mod: mod });
        }
    }

    newControlEvent(interpreter: Interpreter): RoUniversalControlEvent | BrsInvalid {
        const nextKey = this.keysQueue.shift();
        if (nextKey && nextKey.key !== this.lastKey) {
            if (interpreter.singleKeyEvents) {
                if (nextKey.mod === 0) {
                    if (this.lastKey >= 0 && this.lastKey < 100) {
                        this.keysQueue.unshift({ key: nextKey.key, mod: nextKey.mod });
                        nextKey.key = this.lastKey + 100;
                        nextKey.mod = 100;
                    }
                } else if (nextKey.key !== this.lastKey + 100) {
                    return BrsInvalid.Instance;
                }
            }
            interpreter.lastKeyTime = interpreter.currKeyTime;
            interpreter.currKeyTime = performance.now();
            this.lastKey = nextKey.key;
            return new RoUniversalControlEvent("WD:0", nextKey);
        }
        return BrsInvalid.Instance;
    }

    newAudioEvent(interpreter: Interpreter) {
        const flags = Atomics.load(interpreter.sharedArray, DataType.SND);
        if (flags !== this.audioFlags) {
            this.audioFlags = flags;
            if (this.audioFlags >= 0) {
                return new RoAudioPlayerEvent(
                    this.audioFlags,
                    Atomics.load(interpreter.sharedArray, DataType.IDX)
                );
            }
        }
        return BrsInvalid.Instance;
    }

    newVideoEvent(interpreter: Interpreter) {
        const flags = Atomics.load(interpreter.sharedArray, DataType.VDO);
        if (flags !== this.videoFlags) {
            this.videoFlags = flags;
            if (this.videoFlags >= 0) {
                return new RoVideoPlayerEvent(
                    this.videoFlags,
                    Atomics.load(interpreter.sharedArray, DataType.VDX)
                );
            }
        }
        return BrsInvalid.Instance;
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
            if (this.screen || this.audio || this.video) {
                return this.getEvent(interpreter);
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
                this.updateKeysQueue(interpreter);
                const nextKey = this.keysQueue[0];
                if (nextKey) {
                    return new RoUniversalControlEvent("WD:0", nextKey);
                }
            }
            if (this.audio) {
                const flags = Atomics.load(interpreter.sharedArray, DataType.SND);
                if (flags !== this.audioFlags && flags >= 0) {
                    const idx = Atomics.load(interpreter.sharedArray, DataType.IDX);
                    return new RoAudioPlayerEvent(flags, idx);
                }
            }
            if (this.video) {
                const flags = Atomics.load(interpreter.sharedArray, DataType.VDO);
                if (flags !== this.audioFlags && flags >= 0) {
                    const idx = Atomics.load(interpreter.sharedArray, DataType.VDX);
                    return new RoVideoPlayerEvent(flags, idx);
                }
            }
            if (this.messageQueue.length > 0) {
                let message = this.messageQueue[0];
                if (message) {
                    return message;
                }
            }
            if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue[0];
                if (callback) {
                    return callback();
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
