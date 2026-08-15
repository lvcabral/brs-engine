// Exercises `src/api/display.ts` directly (not a compiled bundle) because this module's
// caption-render logic has no other automated coverage: it lives on the browser/main-thread
// side of the API and is never reached by the `packages/*/bin` or `packages/*/lib` bundles
// that the rest of the suite imports (those only cover the worker/interpreter side).
import { setCaptionRenderArea, getCaptionRenderArea } from "../../src/api/display.ts";

function expectArea(input, expected) {
    setCaptionRenderArea(input);
    expect(getCaptionRenderArea()).toEqual(expected);
}

describe("Video.captionRenderArea normalization (Roku OS 15.3)", () => {
    test("reads the documented camelCase sub-field keys (overridePlacement, scaleFonts, keepSafeMargins)", () => {
        // `RoAssociativeArray` literals preserve the app's original key case, so an app using
        // the exact field names from Roku's docs must not have them silently dropped.
        expectArea(
            {
                mode: "override",
                overridePlacement: false,
                scaleFonts: "by-height",
                keepSafeMargins: true,
                x: 10,
                y: 20,
                width: 300,
                height: 100,
            },
            {
                mode: "override",
                overridePlacement: false,
                scaleFonts: "by-height",
                keepSafeMargins: true,
                x: 10,
                y: 20,
                width: 300,
                height: 100,
            }
        );
    });

    test("still accepts all-lowercase keys", () => {
        expectArea(
            {
                mode: "override",
                overrideplacement: false,
                scalefonts: "by-height",
                keepsafemargins: true,
                x: 1,
                y: 2,
                width: 3,
                height: 4,
            },
            {
                mode: "override",
                overridePlacement: false,
                scaleFonts: "by-height",
                keepSafeMargins: true,
                x: 1,
                y: 2,
                width: 3,
                height: 4,
            }
        );
    });

    test("defaults overridePlacement=true and keepSafeMargins=false for override mode when unset", () => {
        expectArea(
            { mode: "override", width: 640, height: 200 },
            {
                mode: "override",
                overridePlacement: true,
                scaleFonts: "by-width",
                keepSafeMargins: false,
                x: 0,
                y: 0,
                width: 640,
                height: 200,
            }
        );
    });

    test("defaults overridePlacement=false and keepSafeMargins=true for auto/fullscreen mode when unset", () => {
        expectArea(
            { mode: "auto" },
            {
                mode: "auto",
                overridePlacement: false,
                scaleFonts: "by-width",
                keepSafeMargins: true,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            }
        );
    });

    test("falls back to fullscreen mode and by-width scaling for unrecognized values", () => {
        expectArea(
            { mode: "bogus", scaleFonts: "bogus" },
            {
                mode: "fullscreen",
                overridePlacement: false,
                scaleFonts: "by-width",
                keepSafeMargins: true,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            }
        );
    });
});
