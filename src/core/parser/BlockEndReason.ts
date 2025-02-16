import { BrsType } from "../brsTypes";
import { BrsError } from "../BrsError";
import { Location } from "../lexer";

/** Marker class for errors thrown to exit block execution early. */
export class BlockEnd extends BrsError {}

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
