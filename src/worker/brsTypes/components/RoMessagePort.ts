import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent, KeyEvent } from "./RoUniversalControlEvent";
import { RoAudioPlayerEvent } from "./RoAudioPlayerEvent";
import { RoVideoPlayerEvent } from "./RoVideoPlayerEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { DataType, MediaEvent, RemoteType, keyArraySpots, keyBufferSize } from "../../../api/enums";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private messageQueue: BrsType[];
    private callbackQueue: Function[]; // TODO: consider having the id of the connected objects
    private keysBuffer: KeyEvent[];
    private lastKey: number;
    private screen: boolean;
    private audioFlags: number;
    private videoFlags: number;
    private videoPosition: number;
    private videoNotificationPeriod: number;
    private videoProgress: number;
    private audio: boolean;
    private video: boolean;
    constructor() {
        super("roMessagePort");
        this.registerMethods({
            ifMessagePort: [this.waitMessage, this.getMessage, this.peekMessage],
        });
        this.messageQueue = [];
        this.callbackQueue = [];
        this.keysBuffer = [];
        this.lastKey = -1;
        this.screen = false;
        this.audioFlags = -1;
        this.videoFlags = -1;
        this.videoPosition = 0;
        this.videoProgress = -1;
        this.videoNotificationPeriod = 0;
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

    resetVideo() {
        this.videoPosition = 0;
    }

    setNotification(period: number) {
        this.videoNotificationPeriod = period;
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
            this.updateKeysBuffer(interpreter);
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

    updateKeysBuffer(interpreter: Interpreter) {
        for (let i = 0; i < keyBufferSize; i++) {
            const idx = i * keyArraySpots;
            const key = Atomics.load(interpreter.sharedArray, DataType.KEY + idx);
            if (key === -1) {
                return;
            } else if (this.keysBuffer.length === 0 || key !== this.keysBuffer.at(-1)?.key) {
                const remoteId = Atomics.load(interpreter.sharedArray, DataType.RID + idx);
                const remoteType = Math.trunc(remoteId / 10) * 10;
                const remoteStr = RemoteType[remoteType] ?? RemoteType[RemoteType.SIM];
                const remoteIdx = remoteId - remoteType;
                const mod = Atomics.load(interpreter.sharedArray, DataType.MOD + idx);
                Atomics.store(interpreter.sharedArray, DataType.KEY + idx, -1);
                this.keysBuffer.push({ remote: `${remoteStr}:${remoteIdx}`, key: key, mod: mod });
            }
        }
    }

    newControlEvent(interpreter: Interpreter): RoUniversalControlEvent | BrsInvalid {
        const nextKey = this.keysBuffer.shift();
        if (nextKey && nextKey.key !== this.lastKey) {
            if (interpreter.singleKeyEvents) {
                if (nextKey.mod === 0) {
                    if (this.lastKey >= 0 && this.lastKey < 100) {
                        this.keysBuffer.unshift({ ...nextKey });
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
            return new RoUniversalControlEvent(nextKey);
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
        const progress = Atomics.load(interpreter.sharedArray, DataType.VLP);
        if (this.videoProgress !== progress && progress >= 0 && progress <= 1000) {
            this.videoProgress = progress;
            return new RoVideoPlayerEvent(MediaEvent.LOADING, progress);
        }
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
        if (this.videoNotificationPeriod >= 1) {
            const position = Atomics.load(interpreter.sharedArray, DataType.VPS);
            if (Math.abs(this.videoPosition - position) >= this.videoNotificationPeriod) {
                this.videoPosition = position;
                return new RoVideoPlayerEvent(MediaEvent.POSITION, position);
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
                this.updateKeysBuffer(interpreter);
                const nextKey = this.keysBuffer[0];
                if (nextKey) {
                    return new RoUniversalControlEvent(nextKey);
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
