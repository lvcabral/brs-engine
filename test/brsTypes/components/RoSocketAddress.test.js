const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { RoSocketAddress, BrsBoolean, BrsString, Int32 } = brs.types;

describe("RoDeviceInfo", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV };
        interpreter = new Interpreter();
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    describe("comparisons", () => {
        it("is equal to nothing", () => {
            let a = new RoSocketAddress(interpreter);
            expect(a.equalTo(a)).toBe(BrsBoolean.False);
        });
    });

    describe("stringification", () => {
        it("lists stringified value", () => {
            let obj = new RoSocketAddress(interpreter);
            expect(obj.toString()).toEqual(`<Component: roSocketAddress>`);
        });
    });

    describe("methods", () => {
        beforeEach(() => {
            interpreter = new Interpreter();
        });
        describe("getAddress", () => {
            it("should return default address", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("getAddress");

                expect(method).toBeTruthy();
                expect(method.call(interpreter)).toEqual(new BrsString("0.0.0.0:0"));
            });
        });
        describe("getHostName", () => {
            it("should return default host", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("getHostName");

                expect(method).toBeTruthy();
                expect(method.call(interpreter)).toEqual(new BrsString("0.0.0.0"));
            });
        });
        describe("getPort", () => {
            it("should return default port", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("getPort");

                expect(method).toBeTruthy();
                expect(method.call(interpreter)).toEqual(new Int32(0));
            });
        });
        describe("isAddressValid", () => {
            it("should return as valid address", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("isAddressValid");

                expect(method).toBeTruthy();
                expect(method.call(interpreter)).toEqual(BrsBoolean.True);
            });
        });
        describe("setAddress", () => {
            it("should return as true", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("setAddress");
                let host = obj.getMethod("getHostName");
                let port = obj.getMethod("getPort");

                expect(method).toBeTruthy();
                expect(method.call(interpreter, new BrsString("roku.com:8080"))).toEqual(BrsBoolean.True);
                expect(host.call(interpreter)).toEqual(new BrsString("roku.com"));
                expect(port.call(interpreter)).toEqual(new Int32(8080));
            });
        });
        describe("setHostName", () => {
            it("should return as true", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("setHostName");
                let host = obj.getMethod("getHostName");

                expect(method).toBeTruthy();
                expect(method.call(interpreter, new BrsString("google.com"))).toEqual(BrsBoolean.True);
                expect(host.call(interpreter)).toEqual(new BrsString("google.com"));
            });
        });
        describe("setPort", () => {
            it("should return as true", () => {
                let obj = new RoSocketAddress(interpreter);
                let method = obj.getMethod("setPort");
                let port = obj.getMethod("getPort");

                expect(method).toBeTruthy();
                expect(method.call(interpreter, new Int32(7070))).toEqual(BrsBoolean.True);
                expect(port.call(interpreter)).toEqual(new Int32(7070));
            });
        });
    });
});
