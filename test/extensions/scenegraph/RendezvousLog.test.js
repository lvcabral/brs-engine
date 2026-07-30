const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { sgRoot } = scenegraph;
const { BrsDevice, DataType, DataBufferIndex } = core;

/**
 * Rendezvous tracing lives in the shared control array rather than in a per-thread field, for two
 * reasons: a rendezvous has two ends, so a per-thread flag would only ever show half of each
 * exchange; and a host needs to turn it on mid-run without the value being frozen into each Task
 * worker's launch payload.
 */
describe("rendezvous logging flag", () => {
    let sharedArray;
    let previous;

    beforeEach(() => {
        previous = BrsDevice.sharedArray;
        sharedArray = new Int32Array(new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * (DataBufferIndex + 16)));
        sharedArray.fill(-1);
        BrsDevice.setSharedArray(sharedArray);
    });

    afterEach(() => {
        sgRoot.logRendezvous = false;
        if (previous) {
            BrsDevice.setSharedArray(previous);
        }
    });

    test("is off when the control array is untouched", () => {
        // A reset fills the array with -1, which must not read as enabled.
        expect(sgRoot.logRendezvous).toBe(false);
    });

    test("round-trips through the shared control array", () => {
        sgRoot.logRendezvous = true;
        expect(Atomics.load(sharedArray, DataType.RDZ)).toBe(1);
        expect(sgRoot.logRendezvous).toBe(true);

        sgRoot.logRendezvous = false;
        expect(Atomics.load(sharedArray, DataType.RDZ)).toBe(0);
        expect(sgRoot.logRendezvous).toBe(false);
    });

    test("observes a change written by another thread", () => {
        // Every thread shares this buffer, so a host toggling the flag reaches Task threads that are
        // already running — the whole point of not keeping it per-thread.
        Atomics.store(sharedArray, DataType.RDZ, 1);
        expect(sgRoot.logRendezvous).toBe(true);

        Atomics.store(sharedArray, DataType.RDZ, 0);
        expect(sgRoot.logRendezvous).toBe(false);
    });

    test("does not collide with the key buffer that follows it", () => {
        // The key buffer occupies KeyBufferSize * KeyArraySpots slots starting at RID, and
        // `DataBufferIndex` is derived from RID so status slots can be added above it freely.
        expect(DataType.RDZ).toBeLessThan(DataType.RID);
        expect(DataBufferIndex).toBe(DataType.RID + 5 * 3);

        sgRoot.logRendezvous = true;
        expect(Atomics.load(sharedArray, DataType.RID)).toBe(-1);
        expect(Atomics.load(sharedArray, DataType.KEY)).toBe(-1);
    });
});
