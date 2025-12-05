/**
 * FileSystem Reliability Tests - tmp: volume
 *
 * These tests directly test the FileSystem class with the SingleBuffer backend
 * to verify data integrity across various file operations and sizes.
 */

const brs = require("../../packages/node/bin/brs.node");
const { Interpreter, BrsDevice } = brs;

let interpreter;
let fs;

brs.registerCallback(() => {}); // register a callback to avoid display errors

describe("FileSystem Reliability Tests - tmp: volume", () => {
    beforeEach(async () => {
        interpreter = new Interpreter({});
        fs = BrsDevice.fileSystem;
        await BrsDevice.resetMemoryVolumes();
    });

    afterEach(() => {
        // Clean up test files after each test
        try {
            const files = fs.readdirSync("tmp:/");
            for (const file of files) {
                try {
                    fs.unlinkSync(`tmp:/${file}`);
                } catch (e) {
                    // Ignore errors during cleanup
                }
            }
        } catch (e) {
            // Ignore if directory doesn't exist
        }
    });

    describe("File Write and Read Integrity", () => {
        test("small files (< 1KB)", async () => {
            await testFileIntegrity(fs, "small", 512);
        });

        test("medium files (1KB - 10KB)", async () => {
            await testFileIntegrity(fs, "medium_1kb", 1024);
            await testFileIntegrity(fs, "medium_5kb", 5 * 1024);
            await testFileIntegrity(fs, "medium_10kb", 10 * 1024);
        });

        test("large files (10KB - 100KB)", async () => {
            await testFileIntegrity(fs, "large_20kb", 20 * 1024);
            await testFileIntegrity(fs, "large_50kb", 50 * 1024);
            await testFileIntegrity(fs, "large_100kb", 100 * 1024);
        });

        test("very large files (> 100KB)", async () => {
            await testFileIntegrity(fs, "vlarge_200kb", 200 * 1024);
            await testFileIntegrity(fs, "vlarge_500kb", 500 * 1024);
        });

        test("multiple files concurrently", async () => {
            const sizes = [512, 1024, 5 * 1024, 10 * 1024, 20 * 1024];
            const files = [];

            // Write all files
            for (let i = 0; i < sizes.length; i++) {
                const size = sizes[i];
                const filename = `tmp:/concurrent_${i}_${size}b.txt`;
                const data = generateTestData(size, i);

                fs.writeFileSync(filename, data);
                files.push({ filename, data, size });
            }

            // Verify all files
            for (const file of files) {
                expect(fs.existsSync(file.filename)).toBe(true);
                const content = fs.readFileSync(file.filename, "utf8");
                expect(content.length).toBe(file.size);
                expect(content).toBe(file.data);
            }
        });

        test("file overwrite integrity", async () => {
            const filename = "tmp:/overwrite_test.txt";
            const sizes = [1024, 2048, 512, 4096, 1024];

            for (let iteration = 0; iteration < sizes.length; iteration++) {
                const size = sizes[iteration];
                const data = generateTestData(size, iteration);

                fs.writeFileSync(filename, data);
                const content = fs.readFileSync(filename, "utf8");

                expect(content.length).toBe(size);
                expect(content).toBe(data);
            }
        });

        test("delete and recreate file", async () => {
            const filename = "tmp:/delete_recreate.txt";

            // Write initial file
            const data1 = generateTestData(5 * 1024, 1);
            fs.writeFileSync(filename, data1);
            expect(fs.existsSync(filename)).toBe(true);

            // Delete file
            fs.unlinkSync(filename);
            expect(fs.existsSync(filename)).toBe(false);

            // Recreate with different size
            const data2 = generateTestData(3 * 1024, 2);
            fs.writeFileSync(filename, data2);
            expect(fs.existsSync(filename)).toBe(true);

            // Verify new file is correct
            const content = fs.readFileSync(filename, "utf8");
            expect(content.length).toBe(3 * 1024);
            expect(content).toBe(data2);
        });

        test("stress test - many small files", async () => {
            const numFiles = 50;
            const fileSize = 256;
            const filesData = [];

            // Write many files
            for (let i = 0; i < numFiles; i++) {
                const filename = `tmp:/stress_${i}.txt`;
                const data = generateTestData(fileSize, i);
                fs.writeFileSync(filename, data);
                filesData.push({ filename, data });
            }

            // Verify all files
            for (const file of filesData) {
                expect(fs.existsSync(file.filename)).toBe(true);
                const content = fs.readFileSync(file.filename, "utf8");
                expect(content).toBe(file.data);
            }
        });

        test("binary data patterns", async () => {
            const patterns = [
                { name: "zeros", byte: 0, size: 1024 },
                { name: "ones", byte: 255, size: 1024 },
                { name: "alternating", byte: 170, size: 1024 }, // 0xAA
                { name: "sequential", byte: null, size: 1024 },
            ];

            for (const pattern of patterns) {
                const filename = `tmp:/pattern_${pattern.name}.txt`;
                const buffer = Buffer.alloc(pattern.size);

                if (pattern.byte !== null) {
                    buffer.fill(pattern.byte);
                } else {
                    for (let i = 0; i < pattern.size; i++) {
                        buffer[i] = i % 256;
                    }
                }

                fs.writeFileSync(filename, buffer);
                const content = fs.readFileSync(filename);

                expect(content.length).toBe(pattern.size);
                expect(Buffer.compare(buffer, content)).toBe(0);
            }
        });

        test("zero byte files", async () => {
            const filename = "tmp:/empty.txt";
            fs.writeFileSync(filename, "");

            expect(fs.existsSync(filename)).toBe(true);
            const stat = fs.statSync(filename);
            expect(stat.size).toBe(0);

            const content = fs.readFileSync(filename, "utf8");
            expect(content).toBe("");
        });
    });

    describe("Metadata Integrity", () => {
        test("verify file stats after operations", async () => {
            const filename = "tmp:/stats_test.txt";
            const size = 10 * 1024;
            const data = generateTestData(size);

            fs.writeFileSync(filename, data);

            const stat = fs.statSync(filename);
            expect(stat).toBeTruthy();
            expect(stat.size).toBe(size);
            expect(stat.isFile()).toBe(true);
            expect(stat.ino).toBeGreaterThan(0);
        });

        test("directory listing consistency", async () => {
            const numFiles = 10;
            const filenames = [];

            // Create files
            for (let i = 0; i < numFiles; i++) {
                const filename = `tmp:/listtest_${i}.txt`;
                fs.writeFileSync(filename, `content${i}`);
                filenames.push(`listtest_${i}.txt`);
            }

            // List directory
            const files = fs.readdirSync("tmp:/");

            // Verify all files exist in listing
            for (const expectedFile of filenames) {
                expect(files).toContain(expectedFile);
            }
        });

        test("file stats remain consistent after operations", async () => {
            const files = [
                { name: "tmp:/meta1.txt", size: 1024 },
                { name: "tmp:/meta2.txt", size: 2048 },
                { name: "tmp:/meta3.txt", size: 512 },
            ];

            const fileStats = [];

            // Write files and collect stats
            for (const file of files) {
                const data = generateTestData(file.size);
                fs.writeFileSync(file.name, data);
                const stat = fs.statSync(file.name);
                fileStats.push({
                    name: file.name,
                    ino: stat.ino,
                    size: stat.size,
                    expectedSize: file.size,
                });
            }

            // Verify stats
            for (const stat of fileStats) {
                expect(stat.size).toBe(stat.expectedSize);
                expect(stat.ino).toBeGreaterThan(0);

                // Re-read stats and verify consistency
                const newStat = fs.statSync(stat.name);
                expect(newStat.ino).toBe(stat.ino);
                expect(newStat.size).toBe(stat.size);
            }
        });
    });

    describe("Fragmentation and Space Reuse", () => {
        test("space reuse after deletion", async () => {
            // Create fragmentation pattern
            fs.writeFileSync("tmp:/frag1.txt", generateTestData(1024));
            fs.writeFileSync("tmp:/frag2.txt", generateTestData(2048));
            fs.writeFileSync("tmp:/frag3.txt", generateTestData(1024));
            fs.writeFileSync("tmp:/frag4.txt", generateTestData(512));

            // Get inode numbers
            const ino1 = fs.statSync("tmp:/frag1.txt").ino;
            const ino2 = fs.statSync("tmp:/frag2.txt").ino;
            const ino3 = fs.statSync("tmp:/frag3.txt").ino;
            const ino4 = fs.statSync("tmp:/frag4.txt").ino;

            // Delete some files to create holes
            fs.unlinkSync("tmp:/frag2.txt");
            fs.unlinkSync("tmp:/frag4.txt");

            // Write new files that should reuse space
            fs.writeFileSync("tmp:/frag5.txt", generateTestData(512));
            fs.writeFileSync("tmp:/frag6.txt", generateTestData(1024));

            // Verify remaining files are intact
            const content1 = fs.readFileSync("tmp:/frag1.txt", "utf8");
            const content3 = fs.readFileSync("tmp:/frag3.txt", "utf8");
            const content5 = fs.readFileSync("tmp:/frag5.txt", "utf8");
            const content6 = fs.readFileSync("tmp:/frag6.txt", "utf8");

            expect(content1).toBe(generateTestData(1024));
            expect(content3).toBe(generateTestData(1024));
            expect(content5).toBe(generateTestData(512));
            expect(content6).toBe(generateTestData(1024));

            console.log("\n=== Fragmentation Test Results ===");
            console.log(`Original inodes: frag1=${ino1}, frag2=${ino2}, frag3=${ino3}, frag4=${ino4}`);
            console.log(
                `New inodes: frag5=${fs.statSync("tmp:/frag5.txt").ino}, frag6=${fs.statSync("tmp:/frag6.txt").ino}`
            );
            console.log("Files verified successfully after fragmentation");
        });

        test("rapid write-read cycles", async () => {
            const iterations = 20;
            const size = 2048;

            for (let i = 0; i < iterations; i++) {
                const filename = `tmp:/rapid_${i}.txt`;
                const data = generateTestData(size, i);

                fs.writeFileSync(filename, data);
                const content = fs.readFileSync(filename, "utf8");

                expect(content).toBe(data);
            }
        });
    });

    describe("Metadata Debugging Utilities", () => {
        test("inspect metadata blocks after operations", async () => {
            // Write files of different sizes
            const files = [
                { name: "tmp:/debug1.txt", size: 1024 },
                { name: "tmp:/debug2.txt", size: 2048 },
                { name: "tmp:/debug3.txt", size: 512 },
                { name: "tmp:/debug4.txt", size: 4096 },
            ];

            const fileStats = [];

            for (const file of files) {
                const data = generateTestData(file.size);
                fs.writeFileSync(file.name, data);
                const stat = fs.statSync(file.name);
                fileStats.push({
                    name: file.name.replace("tmp:/", ""),
                    ino: stat.ino,
                    size: stat.size,
                    expectedSize: file.size,
                });
            }

            // Verify all sizes match
            for (const stat of fileStats) {
                expect(stat.size).toBe(stat.expectedSize);
            }

            console.log("\n=== METADATA INSPECTION INSTRUCTIONS ===");
            console.log("To debug metadata blocks in Node.js REPL:");
            console.log("");
            console.log("const zenFS = require('@zenfs/core');");
            console.log("const sbfs = zenFS.mounts.get('/tmp:');");
            console.log("for (let md = sbfs.store.superblock.metadata; md; md = md.previous) {");
            console.log("    console.log(md.toString(true));");
            console.log("}");
            console.log("");
            console.log("File inodes to check:");
            fileStats.forEach((stat) => {
                console.log(`  ${stat.name}: ino=${stat.ino}, size=${stat.size}`);
            });
            console.log("");
            console.log("Check for:");
            console.log("- Size mismatches between metadata and actual data");
            console.log("- Overlapping blocks");
            console.log("- Invalid or corrupt entries");
            console.log("========================================");
        });

        test("large file stress with verification", async () => {
            const size = 512 * 1024; // 512KB
            const filename = "tmp:/large_stress.txt";

            console.log(`\nCreating large file: ${size} bytes`);

            // Create large file with pattern
            const buffer = Buffer.alloc(size);
            for (let i = 0; i < size; i++) {
                buffer[i] = i % 256;
            }

            fs.writeFileSync(filename, buffer);

            const stat = fs.statSync(filename);
            expect(stat.size).toBe(size);

            // Read back and verify samples
            const content = fs.readFileSync(filename);
            expect(content.length).toBe(size);

            // Check first, middle, and last bytes
            expect(content[0]).toBe(0);
            expect(content[Math.floor(size / 2)]).toBe(Math.floor(size / 2) % 256);
            expect(content[size - 1]).toBe((size - 1) % 256);

            console.log("Large file verified successfully");
        });
    });
});

// Helper functions
function generateTestData(size, seed = 0) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let data = "";
    const offset = seed % chars.length;

    for (let i = 0; i < size; i++) {
        data += chars[(offset + i) % chars.length];
    }

    return data;
}

async function testFileIntegrity(fs, name, size) {
    const filename = `tmp:/${name}.txt`;
    const data = generateTestData(size);

    fs.writeFileSync(filename, data);
    const content = fs.readFileSync(filename, "utf8");

    expect(content.length).toBe(size);
    expect(content).toBe(data);
}
