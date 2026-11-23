import { BrsType } from "../brsTypes";
import { BrsError } from "../error/BrsError";
import { Location } from "../lexer";

/**
 * Sets `Error.stackTraceLimit` to 0 and returns its previous value, or `undefined` when the engine
 * has no numeric limit (e.g. SpiderMonkey) or the property can't be written (a frozen `Error`).
 */
function suppressStackTrace(): number | undefined {
    const limit = Error.stackTraceLimit;
    if (typeof limit !== "number" || limit === 0) {
        return undefined;
    }
    try {
        Error.stackTraceLimit = 0;
    } catch {
        return undefined;
    }
    return limit;
}

/**
 * Marker class for errors thrown to exit block execution early. It is control flow, not a failure,
 * so no JavaScript stack is captured; the BrightScript `location` identifies where it was thrown.
 */
export class BlockEnd extends BrsError {
    constructor(message: string, location: Location) {
        const limit = suppressStackTrace();
        try {
            super(message, location);
        } finally {
            if (limit !== undefined) {
                Error.stackTraceLimit = limit;
            }
        }
    }
}

/** An error thrown to continue a for loop. */
export class ContinueForReason extends BlockEnd {
    constructor(location: Location) {
        super("`continue for` encountered", location);
    }
}

//
/** An error thrown to exit a for loop early. */
export class ExitForReason extends BlockEnd {
    constructor(location: Location) {
        super("`exit for` encountered", location);
    }
}

/** An error thrown to continue a while loop. */
export class ContinueWhileReason extends BlockEnd {
    constructor(location: Location) {
        super("`continue while` encountered", location);
    }
}

/** An error thrown to exit a while loop early. */
export class ExitWhileReason extends BlockEnd {
    constructor(location: Location) {
        super("`exit while` encountered", location);
    }
}

/** An error thrown to handle a `goto` statement. */
export class GotoLabel extends BlockEnd {
    constructor(readonly location: Location, readonly label: string) {
        super("`goto` encountered", location);
    }
}

/** An error thrown to handle a `return` statement. */
export class ReturnValue extends BlockEnd {
    constructor(readonly location: Location, readonly value?: BrsType) {
        super("`return` encountered", location);
    }
}
