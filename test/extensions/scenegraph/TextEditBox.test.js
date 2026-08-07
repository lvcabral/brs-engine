const fs = require("fs");
const path = require("path");
const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { SGNodeFactory, sgRoot } = scenegraph;
const { BrsDevice, BrsString, Float } = core;

/**
 * Regression: TextEditBox has no documented "height" field on real Roku devices (see
 * external/dev-doc TextEditBox reference). The built-in background (backgroundUri="", the
 * default) keeps generous chrome around the text — this must match the original fixed 48/72
 * look (height) and 33/22 (left padding) exactly (regression: an earlier version of this fix
 * shrank the box in this case too, making every default-appearance TextEditBox render
 * abnormally short).
 *
 * Apps that hide the built-in background via `backgroundUri` commonly draw their own, often
 * sized tightly around a single line of text (e.g. Jellyfin's Sign In form), translating the box
 * so its vertical center lines up with sibling elements (a label, a background Poster) rather
 * than its top, and already accounting for their own left margin via the box's translation.x
 * relative to that background. The old fixed padding ("Approximate vertical centering") pushed
 * the text/hint Labels down far enough that such a tight custom background clipped almost all of
 * the glyph vertically, and the fixed 33/22 left padding double-counted the app's own left
 * margin horizontally (over-indenting text/hint from the app's visible box edge). The vertical
 * fix is device-confirmed via test/simulator/probes/texteditbox-vertical-anchor-probe (centered
 * on translation.y, not top-anchored); the horizontal fix (no left chrome padding once a custom
 * background is set) was confirmed by the reporter's side-by-side comparison against a real
 * device, following the same reasoning as the vertical case.
 */
describe("TextEditBox sizes itself from the resolved font's real metrics", () => {
    beforeAll(() => {
        const commonZip = fs.readFileSync(path.join(__dirname, "../../../packages/scenegraph/assets/common.zip"));
        BrsDevice.fileSystem.setup(commonZip.buffer, new ArrayBuffer(1024 * 1024), new ArrayBuffer(1024 * 1024));
    });

    afterEach(() => {
        sgRoot.setFocused();
    });

    /** Runs `body` with a scene forced to `resolution`, restoring the previous scene after. */
    function atResolution(resolution, body) {
        const previous = sgRoot.scene;
        const scene = SGNodeFactory.createNode("Scene");
        sgRoot.setScene(scene);
        scene.setResolution(resolution);
        try {
            return body();
        } finally {
            sgRoot.setScene(previous ?? SGNodeFactory.createNode("Scene"));
        }
    }

    /** Forces a render pass so the reactive `backgroundUri`/width sync in renderNodeContent runs. */
    function render(node) {
        node.renderNode({}, [0, 0], 0, 1);
    }

    test.each([
        ["HD", 48, 22],
        ["FHD", 72, 33],
    ])(
        "%s: default (built-in) background reproduces the original fixed chrome height (%dpx) and left padding (%dpx)",
        (resolution, expectedHeight, expectedPaddingX) => {
            atResolution(resolution, () => {
                const box = SGNodeFactory.createNode("TextEditBox");
                expect(box.getValueJS("height")).toBe(expectedHeight);

                const [textLabel] = box.getNodeChildren();
                const translation = textLabel.getValueJS("translation");
                expect(translation[0]).toBe(expectedPaddingX);
                expect(translation[1]).toBeCloseTo(expectedHeight / 4, 5); // paddingY = lineHeight / 2
                expect(textLabel.getValueJS("height")).toBeCloseTo(expectedHeight / 2, 5); // = lineHeight
            });
        }
    );

    test.each([["HD"], ["FHD"]])(
        "%s: a custom backgroundUri sizes the box to the font's line height, centered on its own translation, with no added left padding",
        (resolution) => {
            atResolution(resolution, () => {
                const box = SGNodeFactory.createNode("TextEditBox");
                box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
                render(box);

                const [textLabel] = box.getNodeChildren();
                const font = textLabel.getValue("font");
                const lineHeight = font.createDrawFont().measureTextHeight();

                expect(box.getValueJS("height")).toBe(lineHeight);
                // The label's own box still exactly fills `height`...
                expect(textLabel.getValueJS("height")).toBe(lineHeight);
                const translation = textLabel.getValueJS("translation");
                // No left chrome padding: the app already accounts for its own left margin via
                // the box's own translation.x relative to its custom background.
                expect(translation[0]).toBe(0);
                // ...and is shifted up by half a line height, so it straddles the box's
                // translation point instead of starting at it.
                expect(translation[1]).toBe(-lineHeight / 2);
            });
        }
    );

    test("a custom background's rendered rect (background/cursor/boundingRect) centers on the translation point", () => {
        atResolution("FHD", () => {
            const box = SGNodeFactory.createNode("TextEditBox");
            box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
            box.setTranslation([100, 40]);
            render(box);

            const rect = box.getBoundingRect("toParent", { environment: {}, inSubEnv: () => {} });
            // translation.y (40) is the vertical center of the reported rect, not its top.
            expect(rect.y).toBeCloseTo(40 - rect.height / 2, 5);
        });
    });

    test("switching backgroundUri back to the default restores the generous chrome height and left padding", () => {
        atResolution("FHD", () => {
            const box = SGNodeFactory.createNode("TextEditBox");
            box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
            render(box);
            expect(box.getValueJS("height")).toBe(36); // hugging the FHD default line height
            const [textLabel] = box.getNodeChildren();
            expect(textLabel.getValueJS("translation")[0]).toBe(0); // no left chrome padding

            box.setValue("backgroundUri", new BrsString(""));
            render(box);
            expect(box.getValueJS("height")).toBe(72); // back to the generous built-in chrome
            expect(textLabel.getValueJS("translation")[0]).toBe(33); // back to the fixed left inset
        });
    });

    /**
     * An app-provided `height` set alongside a custom `backgroundUri` (e.g. an XML attribute, set
     * before the first render) is honored verbatim and top-anchored, instead of being overridden by
     * the tight/centered default. See `explicitHeight` in `TextEditBox.ts`.
     */
    test("a custom backgroundUri with an app-provided height keeps that height, top-anchored, instead of the tight/centered default", () => {
        atResolution("FHD", () => {
            const box = SGNodeFactory.createNode("TextEditBox");
            box.setValue("height", new Float(75));
            box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
            render(box);

            expect(box.getValueJS("height")).toBe(75);
            const [textLabel] = box.getNodeChildren();
            const translation = textLabel.getValueJS("translation");
            expect(translation[0]).toBe(0); // still no left chrome padding
            expect(translation[1]).toBe(0); // top-anchored, not shifted to straddle translation.y
            expect(textLabel.getValueJS("height")).toBe(75); // label fills the full app-provided height
        });
    });

    test("an app-provided height set after a custom backgroundUri is already active still takes effect", () => {
        atResolution("FHD", () => {
            const box = SGNodeFactory.createNode("TextEditBox");
            box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
            render(box);
            expect(box.getValueJS("height")).toBe(36); // still the tight/centered default so far

            box.setValue("height", new Float(75));
            render(box);

            expect(box.getValueJS("height")).toBe(75);
            const [textLabel] = box.getNodeChildren();
            expect(textLabel.getValueJS("translation")[1]).toBe(0);
        });
    });

    /**
     * Regression: the built-in background bitmap load only reacted to backgroundUri going from
     * "" to a real URI, never the other direction. Clearing backgroundUri back to "" resized the
     * box back to the generous built-in chrome (72 FHD) but left the stale custom bitmap in
     * place, stretching it into the now-larger box instead of showing the built-in
     * inputField.9.png.
     */
    test("switching backgroundUri back to the default also reloads the built-in background bitmap", () => {
        atResolution("FHD", () => {
            const box = SGNodeFactory.createNode("TextEditBox");
            expect(box.background.getImageName()).toBe("common:/images/inputField.9.png");

            box.setValue("backgroundUri", new BrsString("pkg:/images/transparent.png"));
            render(box);
            // pkg: isn't mounted in this test environment, so the custom texture itself fails to
            // load (see the ENOENT stderr above) - what matters here is only that the built-in
            // bitmap was swapped out, not the specific replacement.
            expect(box.background?.getImageName()).not.toBe("common:/images/inputField.9.png");

            box.setValue("backgroundUri", new BrsString(""));
            render(box);
            expect(box.background.getImageName()).toBe("common:/images/inputField.9.png");
        });
    });
});
