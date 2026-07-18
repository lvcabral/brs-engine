const brs = require("../../../packages/node/bin/brs.node");
const { RoVideoPlayer, RoAssociativeArray, RoString, BrsString, Int32 } = brs.types;

/** Builds a ContentMetaData-like associative array from the given members. */
function contentItem(members) {
    return new RoAssociativeArray(
        Object.entries(members).map(([name, value]) => ({ name: new BrsString(name), value }))
    );
}

describe("RoVideoPlayer", () => {
    describe("stringification", () => {
        it("lists stringified value", () => {
            let player = new RoVideoPlayer();
            expect(player.toString()).toEqual("<Component: roVideoPlayer>");
        });
    });

    describe("getContent", () => {
        it("reads the url from a plain string", () => {
            let player = new RoVideoPlayer();
            player.contentList = [
                contentItem({
                    url: new BrsString("http://example.com/video.mp4"),
                    streamFormat: new BrsString("mp4"),
                }),
            ];

            expect(player.getContent()).toEqual([
                { url: "http://example.com/video.mp4", streamFormat: "mp4", audioTrack: -1 },
            ]);
        });

        it("reads the url from a boxed string (roString)", () => {
            let player = new RoVideoPlayer();
            player.contentList = [
                contentItem({
                    url: new RoString(new BrsString("http://example.com/video.mp4")),
                    streamFormat: new RoString(new BrsString("MP4")),
                }),
            ];

            expect(player.getContent()).toEqual([
                { url: "http://example.com/video.mp4", streamFormat: "mp4", audioTrack: -1 },
            ]);
        });

        it("reads the url from a boxed string inside a stream object", () => {
            let player = new RoVideoPlayer();
            player.contentList = [
                contentItem({
                    stream: contentItem({ url: new RoString(new BrsString("http://example.com/stream.m3u8")) }),
                    streamFormat: new BrsString("hls"),
                }),
            ];

            expect(player.getContent()).toEqual([
                { url: "http://example.com/stream.m3u8", streamFormat: "hls", audioTrack: -1 },
            ]);
        });

        it("lowercases a boxed streamFormat", () => {
            let player = new RoVideoPlayer();
            player.contentList = [
                contentItem({
                    url: new BrsString("video.mp4"),
                    streamFormat: new RoString(new BrsString("MP4")),
                }),
            ];

            expect(player.getContent()[0].streamFormat).toEqual("mp4");
        });

        it("ignores non-string url values", () => {
            let player = new RoVideoPlayer();
            player.contentList = [
                contentItem({
                    url: new Int32(42),
                    streamFormat: new BrsString("mp4"),
                }),
            ];

            expect(player.getContent()).toEqual([{ url: "", streamFormat: "mp4", audioTrack: -1 }]);
        });
    });
});
