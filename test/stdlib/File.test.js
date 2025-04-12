const brs = require("../../bin/brs.node");
const { Interpreter, BrsDevice } = brs;
const {
    ListDir,
    CopyFile,
    MoveFile,
    DeleteFile,
    DeleteDirectory,
    CreateDirectory,
    FormatDrive,
    ReadAsciiFile,
    WriteAsciiFile,
    MatchFiles,
} = brs.stdlib;
const { BrsString, RoList } = brs.types;

let interpreter;
let fsys;

brs.registerCallback(() => {}); // register a callback to avoid display errors

describe("global file I/O functions", () => {
    beforeEach(() => {
        interpreter = new Interpreter({
            root: "hello/world",
        }); // reset the file systems
        fsys = BrsDevice.fileSystem;
        fsys.resetMemoryFS();
    });

    describe("ListDir", () => {
        it("returns files in a directory", () => {
            fsys.writeFileSync("tmp:/test1.txt", "test contents 1");
            fsys.writeFileSync("tmp:/test2.txt", "test contents 2");
            fsys.mkdirSync("tmp:/test_dir");
            fsys.writeFileSync("tmp:/test_dir/test3.txt", "test contents 3");

            expect(ListDir.call(interpreter, new BrsString("tmp:///")).elements).toEqual([
                new BrsString("test1.txt", true),
                new BrsString("test2.txt", true),
                new BrsString("test_dir", true),
            ]);
        });

        it("returns nothing on a bad path", () => {
            expect(ListDir.call(interpreter, new BrsString("tmp:///ack")).elements).toEqual([]);
        });
    });

    describe("CopyFile", () => {
        it("copies a file", () => {
            fsys.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                CopyFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("tmp:///test1.1.txt")
                ).value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test1.txt")).toBeTruthy();
            expect(fsys.existsSync("tmp:/test1.1.txt")).toBeTruthy();
        });

        it("fails with a false", () => {
            expect(
                CopyFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("ack:///test1.txt")
                ).value
            ).toBeFalsy();

            expect(
                CopyFile.call(
                    interpreter,
                    new BrsString("tmp:///no_such_file.txt"),
                    new BrsString("tmp:///test1.txt")
                ).value
            ).toBeFalsy();
        });
    });

    describe("MoveFile", () => {
        it("moves a file", () => {
            fsys.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                MoveFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("tmp:///test5.txt")
                ).value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test1.txt")).toBeFalsy();
            expect(fsys.existsSync("tmp:/test5.txt")).toBeTruthy();
        });

        it("fails with a false", () => {
            expect(
                MoveFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("ack:///test1.txt")
                ).value
            ).toBeFalsy();

            expect(
                MoveFile.call(
                    interpreter,
                    new BrsString("tmp:///no_such_file.txt"),
                    new BrsString("tmp:///test1.txt")
                ).value
            ).toBeFalsy();
        });
    });

    describe("DeleteFile", () => {
        it("deletes a file", () => {
            fsys.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                DeleteFile.call(interpreter, new BrsString("tmp:///test1.txt")).value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test1.txt")).toBeFalsy();
        });

        it("fails with a false", () => {
            expect(
                DeleteFile.call(interpreter, new BrsString("tmp:///test1.txt")).value
            ).toBeFalsy();
        });
    });

    describe("DeleteDirectory", () => {
        it("deletes a directory", () => {
            fsys.mkdirSync("tmp:/test_dir");

            expect(
                DeleteDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test_dir")).toBeFalsy();
        });

        it("fails with a false", () => {
            fsys.mkdirSync("tmp:/test_dir");
            fsys.writeFileSync("tmp://test_dir/test1.txt", "test contents 1");

            // can't remove a non-empty directory
            expect(
                DeleteDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeFalsy();
        });
    });

    describe("CreateDirectory", () => {
        it("creates a directory", () => {
            expect(
                CreateDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test_dir")).toBeTruthy();

            expect(
                CreateDirectory.call(interpreter, new BrsString("tmp:///test_dir/test_sub_dir"))
                    .value
            ).toBeTruthy();
            expect(fsys.existsSync("tmp:/test_dir/test_sub_dir")).toBeTruthy();
        });

        it("fails with a false", () => {
            fsys.mkdirSync("tmp:/test_dir");

            // can't recreate a directory
            expect(
                CreateDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeFalsy();
        });
    });

    describe("FormatDrive", () => {
        it("fails", () => {
            expect(
                FormatDrive.call(interpreter, new BrsString("foo"), new BrsString("bar")).value
            ).toBeFalsy();
        });
    });

    describe("ReadAsciiFile", () => {
        it("reads an ascii file", () => {
            fsys.writeFileSync("tmp:/test.txt", "test contents");

            expect(ReadAsciiFile.call(interpreter, new BrsString("tmp:///test.txt")).value).toEqual(
                "test contents"
            );

            expect(ReadAsciiFile.call(interpreter, new BrsString("tmp:/test.txt")).value).toEqual(
                "test contents"
            );
        });
    });

    describe("WriteAsciiFile", () => {
        it("fails writing to bad paths", () => {
            expect(
                WriteAsciiFile.call(
                    interpreter,
                    new BrsString("hello.txt"),
                    new BrsString("test contents")
                ).value
            ).toBeFalsy();
        });

        it("writes an ascii file", () => {
            expect(
                WriteAsciiFile.call(
                    interpreter,
                    new BrsString("tmp:///hello.txt"),
                    new BrsString("test contents")
                ).value
            ).toBeTruthy();

            expect(fsys.readFileSync("tmp://hello.txt").toString()).toEqual("test contents");
        });
    });

    describe("MatchFiles", () => {
        it("returns an empty array for unrecognized paths", () => {
            let result = MatchFiles.call(
                interpreter,
                new BrsString("cat:/kitten.cute"),
                new BrsString("*")
            );
            expect(result).toBeInstanceOf(RoList);
            expect(result.elements).toEqual([]);
        });

        it("returns an empty array for non-existent directories", () => {
            let result = MatchFiles.call(
                interpreter,
                new BrsString("cachefs:/does-not-exist"),
                new BrsString("*")
            );
            expect(result).toBeInstanceOf(RoList);
            expect(result.elements).toEqual([]);
        });

        describe("patterns", () => {
            beforeEach(() => {
                const content = "print m";
                fsys.mkdirSync("cachefs:/source");
                fsys.writeFileSync("cachefs:/source/foo.brs", content);
                fsys.writeFileSync("cachefs:/source/bar.brs", content);
                fsys.writeFileSync("cachefs:/source/baz.brs", content);
                fsys.writeFileSync("cachefs:/source/car.brs", content);
                fsys.writeFileSync("cachefs:/source/b*a?d na[me", content);
                fsys.mkdirSync("cachefs:/directory");
            });

            test("empty patterns", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString("")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([]);
            });

            test("* matches 0 or more characters", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString("*.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("foo.brs", true),
                    new BrsString("bar.brs", true),
                    new BrsString("baz.brs", true),
                    new BrsString("car.brs", true),
                ]);
            });

            test("? matches a single character", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString("ba?.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs", true),
                    new BrsString("baz.brs", true),
                ]);
            });

            test("character classes in […]", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString("[a-c]ar.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs", true),
                    new BrsString("car.brs", true),
                ]);
            });

            test("character class negation with [^…]", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString("[^d-zD-Z]ar.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs", true),
                    new BrsString("car.brs", true),
                ]);
            });

            test("escaped special characters", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("cachefs:/source"),
                    new BrsString(String.raw`*\**\?**\[*`)
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([new BrsString("b*a?d na[me", true)]);
            });
        });
    });
});
