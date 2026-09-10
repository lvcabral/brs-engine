const brs = require("../../packages/node/bin/brs.node");
const {
    BrsDevice,
    DataType,
    DataBufferIndex,
    DataBufferSize,
    KeyBufferSize,
    KeyArraySpots,
    RemoteType,
    AnalogAxis,
    analogSlotBase,
} = brs;

function newSharedArray() {
    const length = DataBufferIndex + DataBufferSize;
    const array = new Int32Array(new SharedArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT));
    array.fill(-1);
    return array;
}

/** Writes a synthetic key event into ring-buffer slot `slot` (0-based), mirroring sendKey(). */
function writeKeySlot(array, slot, remoteType, remoteIndex, code, mod) {
    const idx = slot * KeyArraySpots;
    Atomics.store(array, DataType.RID + idx, remoteType + remoteIndex);
    Atomics.store(array, DataType.MOD + idx, mod);
    Atomics.store(array, DataType.KEY + idx, code + mod);
}

describe("BrsDevice controller support", () => {
    let sharedArray;

    beforeEach(() => {
        sharedArray = newSharedArray();
        BrsDevice.setSharedArray(sharedArray);
        BrsDevice.resetKeysBuffer();
        BrsDevice.multiControllers = false;
        BrsDevice.singleKeyEvents = true;
    });

    describe("multi_controllers off (legacy behavior pinned)", () => {
        test("single remote press/release flows through unchanged", () => {
            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0); // select down
            const down = BrsDevice.updateKeysBuffer();
            expect(down).toEqual({ remote: "BT:1", key: 6, mod: 0 });

            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 100); // select up
            const up = BrsDevice.updateKeysBuffer();
            expect(up).toEqual({ remote: "BT:1", key: 106, mod: 100 });
        });

        test(
            "(pinned pre-existing behavior) a press from a second remote while the first is " +
                "held forces a synthetic release instead of delivering the second remote's press " +
                "immediately - and the synthesized event is mislabeled with the second remote's id, " +
                "since only .key/.mod are overwritten, not .remote",
            () => {
                writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0); // remote 1: select down
                const first = BrsDevice.updateKeysBuffer();
                expect(first).toEqual({ remote: "BT:1", key: 6, mod: 0 });

                writeKeySlot(sharedArray, 0, RemoteType.BT, 2, 17, 0); // remote 2: "a" down, still queued
                const syntheticRelease = BrsDevice.updateKeysBuffer();
                expect(syntheticRelease).toEqual({ remote: "BT:2", key: 106, mod: 100 });

                const second = BrsDevice.updateKeysBuffer();
                expect(second).toEqual({ remote: "BT:2", key: 17, mod: 0 });
            }
        );

        test(
            "(pinned pre-existing behavior) a duplicate key code from a different remote is " +
                "not delivered, and its shared-array slot is left uncleared (leaked) rather than " +
                "reset to -1",
            () => {
                writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0);
                writeKeySlot(sharedArray, 1, RemoteType.BT, 2, 6, 0); // same code, different remote
                const first = BrsDevice.updateKeysBuffer();
                expect(first).toEqual({ remote: "BT:1", key: 6, mod: 0 });
                const idx1 = 1 * KeyArraySpots;
                expect(Atomics.load(sharedArray, DataType.KEY + idx1)).toBe(6);
            }
        );
    });

    describe("multi_controllers on", () => {
        beforeEach(() => {
            BrsDevice.multiControllers = true;
        });

        test("two remotes debounce independently - a press on one does not release the other", () => {
            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0); // remote 1: select down
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 6, mod: 0 });

            writeKeySlot(sharedArray, 0, RemoteType.BT, 2, 17, 0); // remote 2: "a" down
            // No synthetic release for remote 1 should be injected - remote 2's press comes through directly.
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:2", key: 17, mod: 0 });

            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 100); // remote 1: select up
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 106, mod: 100 });

            writeKeySlot(sharedArray, 0, RemoteType.BT, 2, 17, 100); // remote 2: "a" up
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:2", key: 117, mod: 100 });
        });

        test(
            "same remote: a second press while the first is held still forces a synthetic " +
                "release (single-key emulation preserved per remote, correctly labeled)",
            () => {
                writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0); // select down
                expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 6, mod: 0 });

                writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 17, 0); // "a" down, select still held
                expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 106, mod: 100 });
                expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 17, mod: 0 });
            }
        );

        test("a duplicate key code from a different remote is NOT dropped (remote-aware dedup)", () => {
            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0);
            writeKeySlot(sharedArray, 1, RemoteType.BT, 2, 6, 0); // same code, different remote
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 6, mod: 0 });
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:2", key: 6, mod: 0 });
        });

        test("resetKeysBuffer() clears per-remote debounce state", () => {
            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0);
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 6, mod: 0 });

            BrsDevice.resetKeysBuffer();

            // Without a reset, this would be treated as a repeat of the still-held key and dropped.
            writeKeySlot(sharedArray, 0, RemoteType.BT, 1, 6, 0);
            expect(BrsDevice.updateKeysBuffer()).toEqual({ remote: "BT:1", key: 6, mod: 0 });
        });
    });

    describe("getAnalogValue()", () => {
        test("returns undefined when multi_controllers is off", () => {
            BrsDevice.multiControllers = false;
            const base = analogSlotBase(RemoteType.BT, 1);
            Atomics.store(sharedArray, base + AnalogAxis.LeftX, 500);
            expect(BrsDevice.getAnalogValue("BT:1", AnalogAxis.LeftX)).toBeUndefined();
        });

        test("decodes a written fixed-point slot back to a float", () => {
            BrsDevice.multiControllers = true;
            const base = analogSlotBase(RemoteType.BT, 1);
            Atomics.store(sharedArray, base + AnalogAxis.LeftX, 500);
            Atomics.store(sharedArray, base + AnalogAxis.RightTrigger, -750);
            expect(BrsDevice.getAnalogValue("BT:1", AnalogAxis.LeftX)).toBeCloseTo(0.5);
            expect(BrsDevice.getAnalogValue("BT:1", AnalogAxis.RightTrigger)).toBeCloseTo(-0.75);
        });

        test("returns undefined for an axis that has never been polled (the -1 sentinel)", () => {
            BrsDevice.multiControllers = true;
            expect(BrsDevice.getAnalogValue("BT:1", AnalogAxis.LeftX)).toBeUndefined();
        });

        test("returns undefined for a non-gamepad remote", () => {
            BrsDevice.multiControllers = true;
            expect(BrsDevice.getAnalogValue("WD:0", AnalogAxis.LeftX)).toBeUndefined();
        });

        test("returns undefined for an out-of-range axis index", () => {
            BrsDevice.multiControllers = true;
            expect(BrsDevice.getAnalogValue("BT:1", 99)).toBeUndefined();
        });
    });
});
