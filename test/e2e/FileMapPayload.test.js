const {
    createMockStreams,
    resourceFile,
    allArgs,
    execute,
    executeWithFileMap,
    executeFromFileMap,
} = require("./E2ETests");

describe("createPayloadFromFileMap API", () => {
    let outputStreams;

    beforeAll(() => {
        outputStreams = createMockStreams();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    test("should execute single BrightScript file from file map", async () => {
        const resourceFiles = [resourceFile("print.brs")];

        // Test with regular file execution for comparison
        await execute(resourceFiles, outputStreams);
        const regularOutput = allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd());

        // Reset mocks for file map execution
        jest.resetAllMocks();

        // Test with file map execution
        await executeWithFileMap(resourceFiles, outputStreams);
        const fileMapOutput = allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd());

        // Both should produce the same output
        expect(fileMapOutput).toEqual(regularOutput);
    });

    test("should execute multiple BrightScript files from file map", async () => {
        const resourceFiles = [resourceFile("multi-file", "test1.brs"), resourceFile("multi-file", "test2.brs")];

        // Test with regular file execution for comparison
        await execute(resourceFiles, outputStreams);
        const regularOutput = allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd());

        // Reset mocks for file map execution
        jest.resetAllMocks();

        // Test with file map execution
        await executeWithFileMap(resourceFiles, outputStreams);
        const fileMapOutput = allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd());

        // Both should produce the same output
        expect(fileMapOutput).toEqual(regularOutput);
    });

    test("should handle custom file map with BrightScript content", async () => {
        const fileMap = new Map();

        // Add main BrightScript file
        const mainCode = `
            sub Main()
                print "Hello from custom file map!"
                testFunction()
            end sub
        `;
        fileMap.set("main.brs", new Blob([mainCode], { type: "text/plain" }));

        // Add library file
        const libCode = `
            function testFunction()
                print "Function from library file"
            end function
        `;
        fileMap.set("lib.brs", new Blob([libCode], { type: "text/plain" }));

        // Add manifest
        const manifest = `
            title=Custom File Map Test
            major_version=1
            minor_version=0
            build_version=1
        `;
        fileMap.set("manifest", new Blob([manifest], { type: "text/plain" }));

        await executeFromFileMap(fileMap, outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Hello from custom file map!",
            "Function from library file",
        ]);
    });

    test("should handle file map with manifest only", async () => {
        const fileMap = new Map();

        // Add minimal BrightScript file
        const mainCode = `
            sub Main()
                print "Minimal test with manifest"
            end sub
        `;
        fileMap.set("main.brs", new Blob([mainCode], { type: "text/plain" }));

        // Add manifest with specific settings
        const manifest = `
            title=Manifest Test App
            major_version=2
            minor_version=5
            build_version=10
            splash_min_time=100
        `;
        fileMap.set("manifest", new Blob([manifest], { type: "text/plain" }));

        await executeFromFileMap(fileMap, outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual(["Minimal test with manifest"]);
    });

    test("should throw error for empty file map", async () => {
        const fileMap = new Map();

        await expect(executeFromFileMap(fileMap, outputStreams)).rejects.toThrow(
            "Invalid or inexistent BrightScript files!"
        );
    });

    test("should throw error for file map without BrightScript files", async () => {
        const fileMap = new Map();

        // Add only manifest (no .brs files)
        const manifest = `
            title=No BRS Files Test
            major_version=1
            minor_version=0
        `;
        fileMap.set("manifest", new Blob([manifest], { type: "text/plain" }));

        // Add some other file type
        fileMap.set("readme.txt", new Blob(["Some readme content"], { type: "text/plain" }));

        await expect(executeFromFileMap(fileMap, outputStreams)).rejects.toThrow(
            "Invalid or inexistent BrightScript files!"
        );
    });

    test("should handle file paths with subdirectories", async () => {
        const fileMap = new Map();

        // Add main file
        const mainCode = `
            sub Main()
                print "Testing subdirectory paths"
                print getLibraryMessage()
            end sub
        `;
        fileMap.set("source/main.brs", new Blob([mainCode], { type: "text/plain" }));

        // Add library in subdirectory
        const libCode = `
            function getLibraryMessage() as string
                return "Message from lib/utils.brs"
            end function
        `;
        fileMap.set("source/lib/utils.brs", new Blob([libCode], { type: "text/plain" }));

        await executeFromFileMap(fileMap, outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Testing subdirectory paths",
            "Message from lib/utils.brs",
        ]);
    });

    test("should process files in correct order", async () => {
        const fileMap = new Map();

        // Add files in a specific order to test processing
        const mainCode = `
            sub Main()
                print "Main function started"
                helper1()
                helper2()
                print "Main function ended"
            end sub
        `;
        fileMap.set("main.brs", new Blob([mainCode], { type: "text/plain" }));

        const helper1Code = `
            function helper1()
                print "Helper 1 executed"
            end function
        `;
        fileMap.set("helper1.brs", new Blob([helper1Code], { type: "text/plain" }));

        const helper2Code = `
            function helper2()
                print "Helper 2 executed"
            end function
        `;
        fileMap.set("helper2.brs", new Blob([helper2Code], { type: "text/plain" }));

        await executeFromFileMap(fileMap, outputStreams);

        expect(allArgs(outputStreams.stdout.write).map((arg) => arg.trimEnd())).toEqual([
            "Main function started",
            "Helper 1 executed",
            "Helper 2 executed",
            "Main function ended",
        ]);
    });
});
