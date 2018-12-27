const { Preprocessor } = require("brs");
const { getManifest, getBsConst } = Preprocessor;

jest.mock("fs");
const fs = require("fs");

describe("manifest support", () => {
    describe("manifest parser", () => {
        afterEach(() => {
            fs.exists.mockRestore();
        });

        it("returns an empty map if manifest not found", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(false));
            expect(
                getManifest("/no/manifest/here")
            ).resolves.toEqual(new Map());
        });

        it("rejects key-value pairs with no '='", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(true));
            fs.readFile.mockImplementation(
                (filename, encoding, cb) => cb(/* no error */ null, "no_equal")
            );

            expect(
                getManifest("/has/key/but/no/equal")
            ).rejects.toThrowError("No '=' detected");
        });

        it("ignores comments", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(true));
            fs.readFile.mockImplementation(
                (filename, encoding, cb) => cb(/* no error */ null, "# this line is ignored!")
            );

            expect(
                getManifest("/has/a/manifest")
            ).resolves.toEqual(new Map());
        });

        it("ignores empty keys and values", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(true));
            fs.readFile.mockImplementation(
                (filename, encoding, cb) => cb(
                    /* no error */ null,
                    ["  =lorem", "ipsum=  "].join("\n")
                )
            );

            expect(
                getManifest("/has/blank/keys/and/values")
            ).resolves.toEqual(new Map());
        });

        it("trims whitespace from keys and values", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(true));
            fs.readFile.mockImplementation(
                (filename, encoding, cb) => cb( /* no error */ null, "    key = value    ")
            );

            expect(
                getManifest("/has/extra/whitespace")
            ).resolves.toEqual(
                new Map([
                    ["key", "value"]
                ])
             );
        });

        it("parses key-value pairs", async () => {
            fs.exists.mockImplementation((filename, cb) => cb(true));
            fs.readFile.mockImplementation(
                (filename, encoding, cb) => cb(
                    /* no error */ null,
                    ["foo=bar=baz", "lorem=true", "five=5"].join("\n")
                )
            );

            return expect(
                getManifest("/has/a/manifest")
            ).resolves.toEqual(
                new Map([
                    [ "foo", "bar=baz" ],
                    [ "lorem", true ],
                    [ "five", 5 ]
                ])
            );
        });
    });

    describe("bs_const parser", () => {
        it("returns an empty map if 'bs_const' isn't found", () => {
            let manifest = new Map([
                [ "containsBsConst", false ]
            ]);
            expect(getBsConst(manifest)).toEqual(new Map());
        });

        it("requires a string value for 'bs_const' attributes", () => {
            let manifest = new Map([
                [ "bs_const", 1.2345 ]
            ]);
            expect(
                () => getBsConst(manifest)
            ).toThrowError("Invalid bs_const right-hand side");
        });

        it("ignores empty key-value pairs", () => {
            let manifest = new Map([
                [ "bs_const", ";;;;" ]
            ]);
            expect(getBsConst(manifest)).toEqual(new Map());
        });

        it("rejects key-value pairs with no '='", () => {
            let manifest = new Map([
                [ "bs_const", "i-have-no-equal" ]
            ]);
            expect(
                () => getBsConst(manifest)
            ).toThrowError("No '=' detected");
        });

        it("trims whitespace from keys and values", () => {
            let manifest = new Map([
                [ "bs_const", "   key   =  true  " ]
            ]);
            expect(getBsConst(manifest)).toEqual(
                new Map([
                    [ "key", true ]
                ])
            );
        });

        it("rejects non-boolean values", () => {
            let manifest = new Map([
                [ "bs_const", "string=word" ]
            ]);

            expect(
                () => getBsConst(manifest)
            ).toThrowError("Invalid value for bs_const key 'string'");
        });

        it("allows case-insensitive booleans", () => {
            let manifest = new Map([
                [ "bs_const", "foo=true;bar=FalSE" ]
            ]);

            expect(getBsConst(manifest)).toEqual(
                new Map([
                    [ "foo", true ],
                    [ "bar", false ]
                ])
            );
        });
    });
});
