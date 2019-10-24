import { BrsValue, ValueKind, BrsString, BrsInvalid, BrsBoolean } from "../BrsType";
import { BrsComponent } from "./BrsComponent";
import { RoUniversalControlEvent } from "./RoUniversalControlEvent";
import { RoAudioPlayerEvent } from "./RoAudioPlayerEvent";
import { BrsType } from "..";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";
import { Int32 } from "../Int32";
import { shared } from "../..";

export class RoMessagePort extends BrsComponent implements BrsValue {
    readonly kind = ValueKind.Object;
    readonly type = { KEY: 0, MOD: 1, SND: 2, IDX: 3, WAV: 4 };
    private messageQueue: BrsType[];
    private buffer: Int32Array;
    private lastKey: number;
    private screen: boolean;
    private lastFlags: number;
    private audio: boolean;
    constructor() {
        super("roMessagePort", ["ifMessagePort"]);
        Object.freeze(this.type);
        this.registerMethods([this.waitMessage, this.getMessage, this.peekMessage]);
        this.messageQueue = [];
        this.lastKey = 0;
        this.screen = false;
        this.lastFlags = -1;
        this.audio = false;
        let buffer = shared.get("buffer");
        if (buffer) {
            this.buffer = buffer;
        } else {
            this.buffer = new Int32Array([]);
        }
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

    toString(parent?: BrsType): string {
        return "<Component: roMessagePort>";
    }

    equalTo(other: BrsType) {
        return BrsBoolean.False;
    }

    wait(ms: number) {
        if (this.screen) {
            if (ms === 0) {
                while (true) {
                    if (this.buffer[0] !== this.lastKey) {
                        this.lastKey = this.buffer[this.type.KEY];
                        return new RoUniversalControlEvent(this.lastKey);
                    }
                }
            } else {
                ms += new Date().getTime();
                while (new Date().getTime() < ms) {
                    if (this.buffer[this.type.KEY] !== this.lastKey) {
                        this.lastKey = this.buffer[this.type.KEY];
                        return new RoUniversalControlEvent(this.lastKey);
                    }
                }
            }
        } else if (this.audio) {
            if (ms === 0) {
                while (true) {
                    if (this.buffer[this.type.SND] !== this.lastFlags) {
                        this.lastFlags = this.buffer[this.type.SND];
                        if (this.lastFlags >= 0) {
                            return new RoAudioPlayerEvent(
                                this.lastFlags,
                                this.buffer[this.type.IDX]
                            );
                        }
                    }
                }
            } else {
                ms += new Date().getTime();
                while (new Date().getTime() < ms) {
                    if (this.buffer[this.type.SND] !== this.lastFlags) {
                        this.lastFlags = this.buffer[this.type.SND];
                        if (this.lastFlags >= 0) {
                            return new RoAudioPlayerEvent(
                                this.lastFlags,
                                this.buffer[this.type.IDX]
                            );
                        }
                    }
                }
            }
        } else if (this.messageQueue.length > 0) {
            let message = this.messageQueue.shift();
            if (message) {
                return message;
            }
        }
        return BrsInvalid.Instance;
    }

    /** Waits until an event object is available or timeout milliseconds have passed. */
    private waitMessage = new Callable("waitMessage", {
        signature: {
            args: [new StdlibArgument("timeout", ValueKind.Int32)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, timeout: Int32) => {
            return this.wait(timeout.getValue());
        },
    });

    /** If an event object is available, it is returned. Otherwise invalid is returned. */
    private getMessage = new Callable("getMessage", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            if (this.screen) {
                if (this.buffer[this.type.KEY] !== this.lastKey) {
                    this.lastKey = this.buffer[this.type.KEY];
                    return new RoUniversalControlEvent(this.lastKey);
                }
            } else if (this.audio) {
                if (this.buffer[this.type.SND] !== this.lastFlags) {
                    this.lastFlags = this.buffer[this.type.SND];
                    if (this.lastFlags >= 0) {
                        return new RoAudioPlayerEvent(this.lastFlags, this.buffer[this.type.IDX]);
                    }
                }
            } else if (this.messageQueue.length > 0) {
                let message = this.messageQueue.shift();
                if (message) {
                    return message;
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
        impl: (_: Interpreter) => {
            if (this.screen) {
                if (this.buffer[this.type.KEY] !== this.lastKey) {
                    return new RoUniversalControlEvent(this.buffer[this.type.KEY]);
                }
            } else if (this.audio) {
                if (this.buffer[this.type.SND] !== this.lastFlags) {
                    if (this.buffer[this.type.SND] >= 0) {
                        return new RoAudioPlayerEvent(
                            this.buffer[this.type.SND],
                            this.buffer[this.type.IDX]
                        );
                    }
                }
            } else if (this.messageQueue.length > 0) {
                let message = this.messageQueue[0];
                if (message) {
                    return message;
                }
            }
            return BrsInvalid.Instance;
        },
    });
}
