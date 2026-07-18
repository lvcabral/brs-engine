const brs = require("../../../packages/node/bin/brs.node");
const { Interpreter } = brs;
const { RoAudioPlayer, RoAssociativeArray, RoArray, RoString, BrsString, Int32 } = brs.types;

/** Builds a ContentMetaData-like associative array from the given members. */
function contentItem(members) {
    return new RoAssociativeArray(
        Object.entries(members).map(([name, value]) => ({ name: new BrsString(name), value }))
    );
}

describe("RoAudioPlayer", () => {
    let interpreter;
    let originalPostMessage;
    let messages;

    beforeEach(() => {
        interpreter = new Interpreter();
        messages = [];
        originalPostMessage = global.postMessage;
        global.postMessage = jest.fn((message) => messages.push(message));
    });

    afterEach(() => {
        global.postMessage = originalPostMessage;
    });

    /** Returns the last posted audio playlist, or undefined if none was posted. */
    function lastPlaylist() {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i] && messages[i].audioPlaylist) {
                return messages[i].audioPlaylist;
            }
        }
        return undefined;
    }

    describe("stringification", () => {
        it("lists stringified value", () => {
            let player = new RoAudioPlayer();
            expect(player.toString()).toEqual("<Component: roAudioPlayer>");
        });
    });

    describe("setContentList", () => {
        it("builds the playlist from plain string urls", () => {
            let player = new RoAudioPlayer();
            let setContentList = player.getMethod("setContentList");
            expect(setContentList).toBeTruthy();

            setContentList.call(
                interpreter,
                new RoArray([contentItem({ url: new BrsString("http://example.com/song.mp3") })])
            );

            expect(lastPlaylist()).toEqual(["http://example.com/song.mp3"]);
        });

        it("builds the playlist from boxed string urls (roString)", () => {
            let player = new RoAudioPlayer();
            let setContentList = player.getMethod("setContentList");
            expect(setContentList).toBeTruthy();

            setContentList.call(
                interpreter,
                new RoArray([
                    contentItem({ url: new RoString(new BrsString("http://example.com/song.mp3")) }),
                    contentItem({ url: new RoString(new BrsString("local.mp3")) }),
                ])
            );

            expect(lastPlaylist()).toEqual(["http://example.com/song.mp3", "local.mp3"]);
        });

        it("skips items whose url is not a string", () => {
            let player = new RoAudioPlayer();
            let setContentList = player.getMethod("setContentList");
            expect(setContentList).toBeTruthy();

            setContentList.call(
                interpreter,
                new RoArray([contentItem({ url: new Int32(1) }), contentItem({ url: new BrsString("keep.mp3") })])
            );

            expect(lastPlaylist()).toEqual(["keep.mp3"]);
        });
    });
});
