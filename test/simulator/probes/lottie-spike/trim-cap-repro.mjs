// Minimal repro of the reported bug: an ellipse stroke (lc=1 "Butt") animated via a growing
// Trim Path (matches layer 10 "Line" in the dynamic-voice-enabled-keyboards sample's lottie.json)
// should render FLAT ends at the two cut points, not rounded ones.
import { parse, ImageSurface } from "lottie.js";
import { writeFile } from "node:fs/promises";

const doc = {
    v: "5.7.0",
    fr: 30,
    ip: 0,
    op: 20,
    w: 200,
    h: 200,
    layers: [
        {
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: "Line",
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [100, 100, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: { a: 0, k: [100, 100, 100] },
            },
            ao: 0,
            shapes: [
                {
                    ty: "gr",
                    nm: "Ellipse 1",
                    it: [
                        {
                            ty: "el",
                            nm: "Ellipse Path 1",
                            p: { a: 0, k: [0, 0] },
                            s: { a: 0, k: [140, 140] },
                        },
                        {
                            ty: "st",
                            nm: "Stroke 1",
                            c: { a: 0, k: [1, 0.6, 0, 1] },
                            o: { a: 0, k: 100 },
                            w: { a: 0, k: 20 },
                            lc: 1,
                            lj: 1,
                        },
                        {
                            ty: "tr",
                            p: { a: 0, k: [0, 0] },
                            a: { a: 0, k: [0, 0] },
                            s: { a: 0, k: [100, 100] },
                            r: { a: 0, k: 0 },
                            o: { a: 0, k: 100 },
                        },
                    ],
                },
                {
                    ty: "tm",
                    nm: "Trim Paths 1",
                    s: { a: 0, k: 0 },
                    e: {
                        a: 1,
                        k: [
                            { o: { x: 1, y: 0 }, i: { x: 0.667, y: 1 }, s: [0], t: 0 },
                            { s: [100], t: 20 },
                        ],
                    },
                    o: { a: 0, k: 0 },
                    m: 1,
                },
            ],
            ip: 0,
            op: 20,
            st: 0,
        },
    ],
};

const anim = parse(doc);
const surface = new ImageSurface(anim.width, anim.height);
for (const frame of [5, 10, 15]) {
    const png = await surface.png(anim, frame);
    await writeFile(new URL(`./trim-cap-frame${frame}.png`, import.meta.url), Buffer.from(png));
}
surface.dispose();
console.log("done");
