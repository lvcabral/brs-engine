import { pollQueueFile } from "../../src/core/device/HelperProcess.ts";
const fs = require("fs");
const os = require("os");
const path = require("path");

describe("pollQueueFile", () => {
    it("consumes only complete lines, leaving a partial trailing line for the next poll", () => {
        const file = path.join(os.tmpdir(), `brs-queue-test-${process.pid}`);
        try {
            fs.writeFileSync(file, '{"a":1}\n{"b":');
            let result = pollQueueFile(file, 0);
            expect(result.lines).toEqual(['{"a":1}']);
            expect(result.newOffset).toBe(8);

            expect(pollQueueFile(file, result.newOffset)).toEqual({ lines: [], newOffset: 8 });

            fs.appendFileSync(file, "2}\n");
            result = pollQueueFile(file, result.newOffset);
            expect(result.lines).toEqual(['{"b":2}']);
            expect(result.newOffset).toBe(fs.statSync(file).size);
        } finally {
            fs.unlinkSync(file);
        }
    });
});
