import { BrsType } from "../brsTypes";
import { BrsError } from "../Error";
import { Location } from "../lexer";

/** Marker class for errors thrown to exit block execution early. */
export class BlockEnd {
    constructor(public message: string, public readonly location: Location) {
        // super(message);
    }

    /**
     * Formats the error into a human-readable string including filename, starting and ending line
     * and column, and the message associated with the error, e.g.:
     *
     * `lorem.brs(1,1-3): Expected '(' after sub name`
     * ```
     */
    format() {
        let location = this.location;

        let formattedLocation: string;

        if (location.start.line === location.end.line) {
            let columns = `${location.start.column}`;
            if (location.start.column !== location.end.column) {
                columns += `-${location.end.column}`;
            }
            formattedLocation = `${location.file}(${location.start.line},${columns})`;
        } else {
            formattedLocation = `${location.file}(${location.start.line},${location.start.column},${location.end.line},${location.end.line})`;
        }

        return `${formattedLocation}: ${this.message}`;
    }
}



//
/** An error thrown to exit a for loop early. */
export class ExitForReason extends BlockEnd {
    constructor(location: Location) {
        super("`exit for` encountered", location);
    }
}

/** An error thrown to exit a while loop early. */
export class ExitWhileReason extends BlockEnd {
    constructor(location: Location) {
        super("`exit while` encountered", location);
    }
}

/** An error thrown to handle a `return` statement. */
export class ReturnValue extends BlockEnd {
    constructor(readonly location: Location, readonly value?: BrsType) {
        super("`return` encountered", location);
    }
}

/** An error thrown when a BrightScript runtime error is encountered. */
export class Runtime extends BrsError { }
