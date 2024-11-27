const brs = require("../../bin/brs.node");
const { Interpreter } = brs;
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
    getPath,
    getScopedPath,
} = brs.stdlib;
const { BrsString, RoList } = brs.types;

let interpreter;
let volume;
let pkgVolume;

brs.registerCallback(() => {}); // register a callback to avoid display errors

describe("global file I/O functions", () => {
    beforeEach(() => {
        interpreter = new Interpreter({
            root: "hello/world",
        }); // reset the file systems
        volume = interpreter.fileSystem;
    });

    describe("file I/O utility utilities", () => {
        it("converts a brs path to a memfs path", () => {
            expect(getPath("tmp:/test.txt")).toEqual("/test.txt");
            expect(getPath("tmp:///test.txt")).toEqual("/test.txt");
        });

        it("converts a brs path to a scoped memfs path", () => {
            expect(getScopedPath(interpreter, "tmp:/test.txt")).toEqual("/test.txt");
            expect(getScopedPath(interpreter, "pkg:/test.txt")).toEqual("hello/world/test.txt");
        });
    });

    describe("ListDir", () => {
        it("returns files in a directory", () => {
            volume.writeFileSync("tmp:/test1.txt", "test contents 1");
            volume.writeFileSync("tmp:/test2.txt", "test contents 2");
            volume.mkdirSync("tmp:/test_dir");
            volume.writeFileSync("tmp:/test_dir/test3.txt", "test contents 3");

            expect(ListDir.call(interpreter, new BrsString("tmp:///")).elements).toEqual([
                new BrsString("test1.txt"),
                new BrsString("test2.txt"),
                new BrsString("test_dir"),
            ]);
        });

        it("returns nothing on a bad path", () => {
            expect(ListDir.call(interpreter, new BrsString("tmp:///ack")).elements).toEqual([]);
        });
    });

    describe("CopyFile", () => {
        it("copies a file", () => {
            volume.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                CopyFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("tmp:///test1.1.txt")
                ).value
            ).toBeTruthy();
            expect(volume.existsSync("tmp:/test1.txt")).toBeTruthy();
            expect(volume.existsSync("tmp:/test1.1.txt")).toBeTruthy();
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
            volume.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                MoveFile.call(
                    interpreter,
                    new BrsString("tmp:///test1.txt"),
                    new BrsString("tmp:///test5.txt")
                ).value
            ).toBeTruthy();
            expect(volume.existsSync("tmp:/test1.txt")).toBeFalsy();
            expect(volume.existsSync("tmp:/test5.txt")).toBeTruthy();
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
            volume.writeFileSync("tmp:/test1.txt", "test contents 1");

            expect(
                DeleteFile.call(interpreter, new BrsString("tmp:///test1.txt")).value
            ).toBeTruthy();
            expect(volume.existsSync("tmp:/test1.txt")).toBeFalsy();
        });

        it("fails with a false", () => {
            expect(
                DeleteFile.call(interpreter, new BrsString("tmp:///test1.txt")).value
            ).toBeFalsy();
        });
    });

    describe("DeleteDirectory", () => {
        it("deletes a directory", () => {
            volume.mkdirSync("tmp:/test_dir");

            expect(
                DeleteDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeTruthy();
            expect(volume.existsSync("/test_dir")).toBeFalsy();
        });

        it("fails with a false", () => {
            volume.mkdirSync("/test_dir");
            volume.writeFileSync("/test_dir/test1.txt", "test contents 1");

            // can't remove a non-empty directory
            expect(
                DeleteDirectory.call(interpreter, new BrsString("tmp:///test_dir/test1.txt")).value
            ).toBeFalsy();
        });
    });

    describe("CreateDirectory", () => {
        it("creates a directory", () => {
            expect(
                CreateDirectory.call(interpreter, new BrsString("tmp:///test_dir")).value
            ).toBeTruthy();
            expect(volume.existsSync("/test_dir")).toBeTruthy();

            expect(
                CreateDirectory.call(interpreter, new BrsString("tmp:///test_dir/test_sub_dir"))
                    .value
            ).toBeTruthy();
            expect(volume.existsSync("/test_dir/test_sub_dir")).toBeTruthy();
        });

        it("fails with a false", () => {
            volume.mkdirSync("/test_dir");

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
            volume.writeFileSync("/test.txt", "test contents");

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

            expect(volume.readFileSync("/hello.txt").toString()).toEqual("test contents");
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
                new BrsString("pkg:/does-not-exist"),
                new BrsString("*")
            );
            expect(result).toBeInstanceOf(RoList);
            expect(result.elements).toEqual([]);
        });

        describe("patterns", () => {
            beforeEach(() => {
                const content = "print m";
                pkgVolume.mkdirSync("/source");
                pkgVolume.writeFileSync("/source/foo.brs", content);
                pkgVolume.writeFileSync("/source/bar.brs", content);
                pkgVolume.writeFileSync("/source/baz.brs", content);
                pkgVolume.writeFileSync("/source/car.brs", content);
                pkgVolume.writeFileSync("/source/b*a?d na[me", content);
                pkgVolume.mkdirSync("/directory");
            });

            test("empty patterns", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString("")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([]);
            });

            test("* matches 0 or more characters", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString("*.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("foo.brs"),
                    new BrsString("bar.brs"),
                    new BrsString("baz.brs"),
                    new BrsString("car.brs"),
                ]);
            });

            test("? matches a single character", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString("ba?.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs"),
                    new BrsString("baz.brs"),
                ]);
            });

            test("character classes in […]", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString("[a-c]ar.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs"),
                    new BrsString("car.brs"),
                ]);
            });

            test("character class negation with [^…]", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString("[^d-zD-Z]ar.brs")
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("bar.brs"),
                    new BrsString("car.brs"),
                ]);
            });

            test("escaped special characters", () => {
                let result = MatchFiles.call(
                    interpreter,
                    new BrsString("pkg:/source"),
                    new BrsString(String.raw`*\**\?**\[*`)
                );
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([new BrsString("b*a?d na[me")]);
            });
        });
    });
});
