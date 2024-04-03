const os = require("os");
const brs = require("../../../lib");
const { RoArray, RoByteArray, BrsBoolean, BrsString, Int32, BrsInvalid } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");
const { createMockStreams } = require("../../e2e/E2ETests");

describe("RoByteArray", () => {
    describe("comparisons", () => {
        it("is equal to nothing", () => {
            let a = new RoArray([]);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists values", () => {
            let arr = new RoByteArray(new Uint8Array([1, 2, 3, 4, 5]));
            expect(arr.toString()).toEqual(
                `<Component: roByteArray> =
[
    1
    2
    3
    4
    5
]`
            );
        });
    });

    describe("get", () => {
        it("returns values from in-bounds indexes", () => {
            let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

            expect(arr.get(new Int32(0))).toEqual(new Int32(1));
            expect(arr.get(new Int32(2))).toEqual(new Int32(3));
        });

        it("returns invalid for out-of-bounds indexes", () => {
            let arr = new RoByteArray();

            expect(arr.get(new Int32(555))).toBe(BrsInvalid.Instance);
        });
    });

    describe("set", () => {
        it("sets values at in-bounds indexes", () => {
            let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

            arr.set(new Int32(0), new Int32(4));
            arr.set(new Int32(2), new Int32(5));

            expect(arr.get(new Int32(0))).toEqual(new Int32(4));
            expect(arr.get(new Int32(2))).toEqual(new Int32(5));
        });

        it("sets values at out-of-bounds indexes", () => {
            let arr = new RoByteArray([]);

            arr.set(new Int32(70), new Int32(30));
            expect(arr.elements.length).toEqual(71);
            expect(arr.get(new Int32(70))).toEqual(new Int32(30));
        });
    });

    describe("ifArray methods", () => {
        let interpreter;

        beforeEach(() => {
            let mockStreams = createMockStreams();
            interpreter = new Interpreter({
                stdout: mockStreams.stdout,
                stderr: mockStreams.stderr,
            });
        });

        describe("peek", () => {
            it("returns the value at the highest index", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toEqual(new Int32(3));
            });

            it("returns `invalid` when empty", () => {
                let arr = new RoByteArray();

                let peek = arr.getMethod("peek");
                expect(peek).toBeTruthy();
                expect(peek.call(interpreter)).toBe(BrsInvalid.Instance);
            });
        });

        describe("pop", () => {
            it("returns and removes the value at the highest index", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();
                expect(pop.call(interpreter)).toEqual(new Int32(3));
                expect(arr.elements).toEqual(new Uint8Array([1, 2]));
            });

            it("returns and removes the value of the last element", () => {
                let arr = new RoByteArray(new Uint8Array([1]));

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();
                expect(pop.call(interpreter)).toEqual(new Int32(1));
                expect(arr.elements).toEqual(new Uint8Array(0));
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new RoByteArray();

                let pop = arr.getMethod("pop");
                expect(pop).toBeTruthy();

                let before = arr.getElements();
                expect(pop.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("push", () => {
            it("appends a value to the end of the array", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2]));

                let push = arr.getMethod("push");
                expect(push).toBeTruthy();
                expect(push.call(interpreter, new Int32(3))).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual(new Uint8Array([1, 2, 3]));
            });
        });

        describe("shift", () => {
            it("returns and removes the value at the lowest index", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();
                expect(shift.call(interpreter)).toEqual(new Int32(1));
                expect(arr.elements).toEqual(new Uint8Array([2, 3]));
            });

            it("returns and removes the value of the last element", () => {
                let arr = new RoByteArray(new Uint8Array([3]));

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();
                expect(shift.call(interpreter)).toEqual(new Int32(3));
                expect(arr.elements).toEqual(new Uint8Array(0));
            });

            it("returns `invalid` and doesn't modify when empty", () => {
                let arr = new RoByteArray();

                let shift = arr.getMethod("shift");
                expect(shift).toBeTruthy();

                let before = arr.getElements();
                expect(shift.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.getElements()).toEqual(before);
            });
        });

        describe("unshift", () => {
            it("inserts a value at the beginning of the array", () => {
                let arr = new RoByteArray(new Uint8Array([2, 3]));

                let unshift = arr.getMethod("unshift");
                expect(unshift).toBeTruthy();
                expect(unshift.call(interpreter, new Int32(1))).toBe(BrsInvalid.Instance);
                expect(arr.elements).toEqual(new Uint8Array([1, 2, 3]));
            });
        });

        describe("delete", () => {
            it("removes elements from in-bounds indices", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1))).toBe(BrsBoolean.True);
                expect(arr.elements).toEqual(new Uint8Array([1, 3]));
            });

            it("doesn't remove elements from out-of-bounds indices", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let deleteMethod = arr.getMethod("delete");
                expect(deleteMethod).toBeTruthy();
                expect(deleteMethod.call(interpreter, new Int32(1111))).toBe(BrsBoolean.False);
                expect(deleteMethod.call(interpreter, new Int32(-1))).toBe(BrsBoolean.False);
                expect(arr.elements).toEqual(new Uint8Array([1, 2, 3]));
            });
        });

        describe("count", () => {
            it("returns the length of the array", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let count = arr.getMethod("count");
                expect(count).toBeTruthy();
                expect(count.call(interpreter)).toEqual(new Int32(3));
            });
        });

        describe("clear", () => {
            it("empties the array", () => {
                let arr = new RoByteArray(new Uint8Array([1, 2, 3]));

                let clear = arr.getMethod("clear");
                expect(clear).toBeTruthy();
                expect(clear.call(interpreter)).toBe(BrsInvalid.Instance);
                expect(arr.elements.length).toEqual(0);
            });
        });

        describe("append", () => {
            it("adds non-empty elements to the current array", () => {
                let src = new RoByteArray(new Uint8Array([1, 2, 3]));
                let other = new RoByteArray(new Uint8Array([4, 5, 6, 7]));

                let append = src.getMethod("append");
                expect(append).toBeTruthy();
                expect(append.call(interpreter, other)).toBe(BrsInvalid.Instance);
                expect(src.elements).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7]));
            });
        });

        describe("ifByteArray methods", () => {
            describe("fromAsciiString", () => {
                it("converts a string to a byte array", () => {
                    let src = new RoByteArray(new Uint8Array([1, 2, 3]));
                    let fromAsciiString = src.getMethod("fromAsciiString");
                    expect(fromAsciiString).toBeTruthy();

                    fromAsciiString.call(interpreter, new BrsString("hello"));
                    expect(src.elements).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
                });
            });
            describe("toAsciiString", () => {
                it("converts a byte array to a string", () => {
                    let src = new RoByteArray(new Uint8Array([104, 101, 108, 108, 111]));
                    let toAsciiString = src.getMethod("toAsciiString");
                    expect(toAsciiString).toBeTruthy();

                    let result = toAsciiString.call(interpreter);
                    expect(result).toEqual(new BrsString("hello"));
                });
            });
            describe("fromBase64String", () => {
                it("converts a base64 string to a byte array", () => {
                    let src = new RoByteArray(new Uint8Array([1, 2, 3]));
                    let fromBase64String = src.getMethod("fromBase64String");
                    expect(fromBase64String).toBeTruthy();

                    fromBase64String.call(interpreter, new BrsString("aGVsbG8="));
                    expect(src.elements).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
                });
            });
            describe("toBase64String", () => {
                it("converts a byte array to a base64 string", () => {
                    let src = new RoByteArray(new Uint8Array([104, 101, 108, 108, 111]));
                    let toBase64String = src.getMethod("toBase64String");
                    expect(toBase64String).toBeTruthy();

                    let result = toBase64String.call(interpreter);
                    expect(result).toEqual(new BrsString("aGVsbG8="));
                });
            });
            describe("fromHexString", () => {
                it("converts a hex string to a byte array", () => {
                    let src = new RoByteArray();
                    let fromHexString = src.getMethod("fromHexString");
                    expect(fromHexString).toBeTruthy();

                    fromHexString.call(interpreter, new BrsString("AA010203ff"));
                    expect(src.elements).toEqual(new Uint8Array([170, 1, 2, 3, 255]));
                });
            });
            describe("toHexString", () => {
                it("converts a byte array to a hex string", () => {
                    let src = new RoByteArray(new Uint8Array([170, 1, 2, 3, 255]));
                    let toHexString = src.getMethod("toHexString");
                    expect(toHexString).toBeTruthy();

                    let result = toHexString.call(interpreter);
                    expect(result).toEqual(new BrsString("AA010203FF"));
                });
            });
            describe("getSignedByte", () => {
                it("returns the signed byte at the specified index", () => {
                    let src = new RoByteArray(new Uint8Array([0, 127, 128, 255]));
                    let getSignedByte = src.getMethod("getSignedByte");
                    expect(getSignedByte).toBeTruthy();

                    expect(getSignedByte.call(interpreter, new Int32(0))).toEqual(new Int32(0));
                    expect(getSignedByte.call(interpreter, new Int32(1))).toEqual(new Int32(127));
                    expect(getSignedByte.call(interpreter, new Int32(2))).toEqual(new Int32(-128));
                    expect(getSignedByte.call(interpreter, new Int32(3))).toEqual(new Int32(-1));
                });
            });
            describe("getSignedLong", () => {
                it("returns the signed long at the specified index", () => {
                    let src = new RoByteArray(
                        new Uint8Array([
                            0, 0, 0, 0, 127, 3, 127, 3, 0, 0, 0, 128, 255, 255, 255, 255,
                        ])
                    );
                    let getSignedLong = src.getMethod("getSignedLong");
                    expect(getSignedLong).toBeTruthy();

                    expect(getSignedLong.call(interpreter, new Int32(0))).toEqual(new Int32(0));
                    expect(getSignedLong.call(interpreter, new Int32(1))).toEqual(
                        new Int32(58655615)
                    );
                    expect(getSignedLong.call(interpreter, new Int32(2))).toEqual(
                        new Int32(-2147483648)
                    ); // 128 shifted left 24 places
                    expect(getSignedLong.call(interpreter, new Int32(3))).toEqual(new Int32(-1)); // 255 repeated 4 times is -1 in two's complement
                });
            });
            describe("getCRC32", () => {
                it("returns the CRC32 of the byte array", () => {
                    let src = new RoByteArray(new Uint8Array([104, 101, 108, 108, 111]));
                    let getCRC32 = src.getMethod("getCRC32");
                    expect(getCRC32).toBeTruthy();

                    let result = getCRC32.call(interpreter);
                    expect(result).toEqual(new Int32(907060870));
                });
            });
            describe("isLittleEndianCPU", () => {
                it("returns true if the CPU is little-endian", () => {
                    let src = new RoByteArray();
                    let isLittleEndianCPU = src.getMethod("isLittleEndianCPU");
                    expect(isLittleEndianCPU).toBeTruthy();

                    let expected = os.endianness() === "LE";
                    let result = isLittleEndianCPU.call(interpreter);
                    expect(result).toBe(BrsBoolean.from(expected));
                });
            });
        });
    });
});
