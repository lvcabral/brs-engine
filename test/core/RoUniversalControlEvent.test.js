const brs = require("../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoUniversalControlEvent, Int32, Float } = brs.types;
const { BrsDevice, DataBufferIndex, DataBufferSize, AnalogAxis, RemoteType, analogSlotBase } = brs;

function newSharedArray() {
    const length = DataBufferIndex + DataBufferSize;
    const array = new Int32Array(new SharedArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT));
    array.fill(-1);
    return array;
}

function getValue(event, interpreter, axis) {
    const method = event.getMethod("getvalue");
    return method.call(interpreter, new Int32(axis));
}

describe("roUniversalControlEvent GetValue() extension", () => {
    let interpreter;
    let sharedArray;

    beforeEach(() => {
        interpreter = new Interpreter();
        sharedArray = newSharedArray();
        BrsDevice.setSharedArray(sharedArray);
        BrsDevice.multiControllers = false;
    });

    test("falls back to digital 1.0 on a press when multi_controllers is off", () => {
        const event = new RoUniversalControlEvent({ remote: "BT:1", key: 6, mod: 0 });
        const result = getValue(event, interpreter, AnalogAxis.LeftX);
        expect(result).toBeInstanceOf(Float);
        expect(result.getValue()).toBeCloseTo(1);
    });

    test("falls back to digital 0.0 on a release when multi_controllers is off", () => {
        const event = new RoUniversalControlEvent({ remote: "BT:1", key: 106, mod: 100 });
        const result = getValue(event, interpreter, AnalogAxis.LeftX);
        expect(result.getValue()).toBeCloseTo(0);
    });

    test("returns the live decoded analog value when multi_controllers is on for a tracked gamepad", () => {
        BrsDevice.multiControllers = true;
        const base = analogSlotBase(RemoteType.BT, 1);
        Atomics.store(sharedArray, base + AnalogAxis.RightY, -320);

        const event = new RoUniversalControlEvent({ remote: "BT:1", key: 6, mod: 0 });
        const result = getValue(event, interpreter, AnalogAxis.RightY);
        expect(result.getValue()).toBeCloseTo(-0.32);
    });

    test("still falls back to digital 0/1 when multi_controllers is on but the remote isn't a gamepad", () => {
        BrsDevice.multiControllers = true;
        const event = new RoUniversalControlEvent({ remote: "WD:0", key: 6, mod: 0 });
        const result = getValue(event, interpreter, AnalogAxis.LeftX);
        expect(result.getValue()).toBeCloseTo(1);
    });

    test("existing digital methods (getKey/getID/isPress) are unaffected by the new method", () => {
        const event = new RoUniversalControlEvent({ remote: "BT:1", key: 6, mod: 0 });
        expect(event.getMethod("getKey").call(interpreter).getValue()).toBe(6);
        expect(event.getMethod("getID").call(interpreter).getValue()).toBe(6);
        expect(event.getMethod("isPress").call(interpreter).toBoolean()).toBe(true);
        expect(event.getMethod("getRemoteID").call(interpreter).toString()).toBe("BT:1");
    });
});
