/*---------------------------------------------------------------------------------------------
 *  BrightScript Engine (https://github.com/lvcabral/brs-engine)
 *
 *  Copyright (c) 2019-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Proxies a `stdout`-like stream to provide current-column tracking. */
export class OutputProxy {
    currentLineLength = 0;

    /**
     * Creates a new proxy that tracks the current column of the provided stream.
     * @param outputStream the stream to proxy writes to
     * @param post whether to post messages to the parent thread. defaults to true
     */
    constructor(private readonly outputStream: NodeJS.WriteStream, private readonly post: boolean = true) {}

    /**
     * Writes a string's worth of data to the proxied stream and updates the current output column.
     * @param str the string to write to the proxied stream
     */
    write(str: string) {
        let content = str;
        const level = str.split(",")[0];
        if (["print", "error", "warning"].includes(level)) {
            content = str.slice(level.length + 1);
            if (this.post) {
                postMessage(str);
            }
        }
        if (!this.post && content.length) {
            this.outputStream.write(content);
        }
        this.position(content);
    }

    /**
     * Calculates and returns the column that the next written character will
     * be placed in. If the proxied stream is a TTY, the current position will
     * be in the range `[0, proxiedStream.columns)`.
     *
     * @param str optional string to update the current position
     * @returns the zero-indexed position at which the next written character
     *          will be placed in the proxied output stream.
     */
    position(str?: string) {
        if (str) {
            const lines = str.split("\n");
            if (lines.length > 1) {
                // the length of the most recent line is now the current line length
                this.currentLineLength = lines.at(-1)!.length;
            } else {
                // but if this wasn't a multi-line string, we're just appending to the current line
                this.currentLineLength += str.length;
            }
        }

        if (!this.outputStream?.isTTY || !this.outputStream?.columns) {
            return this.currentLineLength;
        }
        return this.currentLineLength % this.outputStream.columns;
    }
}
