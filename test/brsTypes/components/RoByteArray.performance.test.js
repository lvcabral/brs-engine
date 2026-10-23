const brs = require("../../../packages/node/bin/brs.node");
const { RoByteArray, Float, Int32, BrsInvalid } = brs.types;

test("reads a byte without materializing the whole array", () => {
    const bytes = new RoByteArray(new Uint8Array([1, 2, 3]));
    const getElements = vi.spyOn(bytes, "getElements");

    expect(bytes.get(new Int32(1))).toEqual(new Int32(2));
    expect(bytes.get(new Float(2.9))).toEqual(new Int32(3));
    expect(bytes.get(new Int32(3))).toBe(BrsInvalid.Instance);
    expect(getElements).not.toHaveBeenCalled();
});
