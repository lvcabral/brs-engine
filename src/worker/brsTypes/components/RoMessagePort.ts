import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent, KeyEvent } from "./RoUniversalControlEvent";
import { RoAudioPlayerEvent } from "./RoAudioPlayerEvent";
import { RoVideoPlayerEvent } from "./RoVideoPlayerEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import {
    BufferType,
    DataType,
    DebugCommand,
    MediaEvent,
    RemoteType,
    keyArraySpots,
    keyBufferSize,
} from "../../enums";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private messageQueue: BrsType[];
    private callbackQueue: Function[]; // TODO: consider having the id of the connected objects
    private keysBuffer: KeyEvent[];
    private lastKey: number;
    private screen: boolean;
    private audioFlags: number;
    private videoFlags: number;
    private videoIndex: number;
    private videoPosition: number;
    private videoNotificationPeriod: number;
    private videoProgress: number;
    private audio: boolean;
    private video: boolean;
    private audioTracks: any[];

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
        this.videoIndex = -1;
        this.videoPosition = 0;
        this.videoProgress = -1;
        this.videoNotificationPeriod = 0;
        this.audio = false;
        this.video = false;
        this.audioTracks = [];
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
                this.updateMessageQueue(interpreter);
                if (this.messageQueue.length > 0) {
                    return this.messageQueue.shift();
                }
                const cmd = interpreter.checkBreakCommand();
                if (cmd === DebugCommand.BREAK || cmd === DebugCommand.EXIT) {
                    return BrsInvalid.Instance;
                }
            }
        } else {
            if (this.messageQueue.length > 0) {
                return this.messageQueue.shift();
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
                    const cmd = interpreter.checkBreakCommand();
                    if (cmd === DebugCommand.BREAK || cmd === DebugCommand.EXIT) {
                        return BrsInvalid.Instance;
                    }
                }
            } else {
                postMessage("warning,[roMessagePort] No message in the queue!");
                ms += performance.now();
                while (performance.now() < ms) {
                    //wait the timeout time
                    const cmd = interpreter.checkBreakCommand();
                    if (cmd === DebugCommand.BREAK || cmd === DebugCommand.EXIT) {
                        return BrsInvalid.Instance;
                    }
                }
            }
        }
        return BrsInvalid.Instance;
    }

    updateMessageQueue(interpreter: Interpreter) {
        if (this.screen) {
            this.updateKeysBuffer(interpreter);
            const ctrlEvent = this.newControlEvent(interpreter);
            if (ctrlEvent instanceof RoUniversalControlEvent) {
                this.messageQueue.push(ctrlEvent);
            }
        }
        if (this.audio) {
            const audioEvent = this.newAudioEvent(interpreter);
            if (audioEvent instanceof RoAudioPlayerEvent) {
                this.messageQueue.push(audioEvent);
            }
        }
        if (this.video) {
            this.processVideoMessages(interpreter);
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

    processVideoMessages(interpreter: Interpreter) {
        const selected = Atomics.load(interpreter.sharedArray, DataType.VSE);
        if (selected >= 0) {
            this.messageQueue.push(new RoVideoPlayerEvent(MediaEvent.SELECTED, selected));
            Atomics.store(interpreter.sharedArray, DataType.VSE, -1);
        }
        const bufferFlag = Atomics.load(interpreter.sharedArray, DataType.BUF);
        if (bufferFlag === BufferType.AUDIO_TRACKS) {
            const strTracks = interpreter.readDataBuffer();
            try {
                this.audioTracks = JSON.parse(strTracks);
            } catch (e) {
                this.audioTracks = [];
            }
            Atomics.store(interpreter.sharedArray, DataType.BUF, -1);
        }
        const flags = Atomics.load(interpreter.sharedArray, DataType.VDO);
        const index = Atomics.load(interpreter.sharedArray, DataType.VDX);
        if (flags !== this.videoFlags || index !== this.videoIndex) {
            this.videoFlags = flags;
            this.videoIndex = index;
            if (this.videoFlags >= 0) {
                this.messageQueue.push(new RoVideoPlayerEvent(this.videoFlags, this.videoIndex));
                Atomics.store(interpreter.sharedArray, DataType.VDO, -1);
                Atomics.store(interpreter.sharedArray, DataType.VDX, -1);
            }
        }
        const progress = Atomics.load(interpreter.sharedArray, DataType.VLP);
        if (this.videoProgress !== progress && progress >= 0 && progress <= 1000) {
            this.videoProgress = progress;
            this.messageQueue.push(new RoVideoPlayerEvent(MediaEvent.LOADING, progress));
            if (progress === 1000) {
                this.messageQueue.push(new RoVideoPlayerEvent(MediaEvent.START_PLAY, 0));
            }
        }
        if (this.videoNotificationPeriod >= 1) {
            const position = Atomics.load(interpreter.sharedArray, DataType.VPS);
            if (Math.abs(this.videoPosition - position) >= this.videoNotificationPeriod) {
                this.videoPosition = position;
                this.messageQueue.push(new RoVideoPlayerEvent(MediaEvent.POSITION, position));
            }
        }
    }

    getAudioTracks() {
        return this.audioTracks;
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
                this.updateMessageQueue(interpreter);
            }
            if (this.messageQueue.length > 0) {
                return this.messageQueue.shift();
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
            this.updateMessageQueue(interpreter);
            if (this.messageQueue.length > 0) {
                return this.messageQueue[0];
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
