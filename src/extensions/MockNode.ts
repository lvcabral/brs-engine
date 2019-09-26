import { RoSGNode, Callable, RoAssociativeArray, BrsType, BrsString } from "../brsTypes";

export class MockNode extends RoSGNode {
    constructor(mock: RoAssociativeArray) {
        super([]);

        // set up the fields here
        let mockElements = mock.getValue();
        mockElements.forEach((value: BrsType, key: string) => {
            if (value instanceof Callable) {
                // register callable method on mockNode
                this.appendMethod(key, value);
            } else {
                // add field to mockNode
                this.set(new BrsString(key), value);
            }
        });
    }
}
