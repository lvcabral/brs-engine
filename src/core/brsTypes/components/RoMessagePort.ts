import { BrsValue, ValueKind, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { BrsEvent, BrsType, isBrsEvent, RoAudioPlayerEvent, RoVideoPlayerEvent } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { BufferType, DataType, DebugCommand, MediaEvent } from "../../common";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    private readonly messageQueue: BrsEvent[];
    private readonly callbackQueue: Function[];
    private readonly callbackMap: Map<string, Function>;
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
        this.callbackMap = new Map();
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

    pushMessage(object: BrsEvent) {
        this.messageQueue.push(object);
    }

    pushCallback(callback: Function) {
        this.callbackQueue.push(callback);
    }

    registerCallback(component: string, callback: Function) {
        this.addReference();
        this.callbackMap.set(component, callback);
    }

    unregisterCallback(component: string) {
        this.removeReference();
        this.callbackMap.delete(component);
    }

    asyncCancel() {
        this.callbackQueue.length = 0;
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

        while (loop || performance.now() < ms) {
            this.updateMessageQueue(interpreter);
            if (this.messageQueue.length > 0) {
                return this.messageQueue.shift();
            } else if (this.callbackQueue.length > 0) {
                let callback = this.callbackQueue.shift();
                if (typeof callback === "function") {
                    const event = callback();
                    if (event !== BrsInvalid.Instance) {
                        return event;
                    }
                }
            }
            const cmd = interpreter.checkBreakCommand();
            if (cmd === DebugCommand.BREAK || cmd === DebugCommand.EXIT) {
                return BrsInvalid.Instance;
            }
        }
        return BrsInvalid.Instance;
    }

    updateMessageQueue(interpreter: Interpreter) {
        if (this.callbackMap.size > 0) {
            for (const [_, callback] of this.callbackMap.entries()) {
                const event = callback();
                if (isBrsEvent(event)) {
                    this.messageQueue.push(event);
                }
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
    private readonly waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Object,
        },
        impl: (interpreter: Interpreter, timeout: Int32) => {
            return this.wait(interpreter, timeout.getValue());
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private readonly getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (interpreter: Interpreter) => {
            this.updateMessageQueue(interpreter);
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
    private readonly peekMessage = new Callable("peekMessage", {
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
                    const msg = callback();
                    if (msg !== BrsInvalid.Instance) {
                        this.messageQueue.push(msg);
                        return msg;
                    }
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
