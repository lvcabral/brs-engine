/** Proxies a `stdout`-like stream to provide current-column tracking. */
export class OutputProxy {
    currentLineLength = 0;

    /**
     * Creates a new proxy that tracks the current column of the provided stream.
     * @param outputStream the stream to proxy writes to
     */
    constructor(private outputStream: NodeJS.WriteStream) {}

    /**
     * Writes a string's worth of data to the proxied stream and updates the current output column.
     * @param str the string to write to the proxied stream
     */
    write(str: string) {
        this.outputStream.write(str);

        let lines = str.split("\n");

        if (lines.length > 1) {
            // the length of the most recent line is now the current line length
            this.currentLineLength = lines[lines.length - 1].length;
            return;
        }

        // but if this wasn't a multi-line string, we're just appending to the current line
        this.currentLineLength += str.length;
    }

    /**
     * Calculates and returns the column that the next written character will
     * be placed in. If the proxied stream is a TTY, the current position will
     * be in the range `[0, proxiedStream.columns)`.
     *
     * @returns the zero-indexed position at which the next written character
     *          will be placed in the proxied output stream.
     */
    position() {
        if (!this.outputStream.isTTY || !this.outputStream.columns) {
            return this.currentLineLength;
        }

        return this.currentLineLength % this.outputStream.columns;
    }
}
