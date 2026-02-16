const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const {
    rectContainsRect,
    rotateRect,
    rotateTranslation,
    unionRect,
    convertNumber,
    convertLong,
    convertHexColor,
} = scenegraph;
const Long = require("long");

describe("SGUtil", () => {
    describe("rectContainsRect", () => {
        describe("full containment", () => {
            test("returns 'full' when inner rect is completely inside outer rect", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 10, y: 10, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("full");
            });

            test("returns 'full' when inner rect is exactly the same as outer rect", () => {
                const rect = { x: 0, y: 0, width: 100, height: 100 };
                expect(rectContainsRect(rect, rect)).toBe("full");
            });

            test("returns 'full' when inner rect touches outer rect edges", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 100, height: 100 };
                expect(rectContainsRect(outer, inner)).toBe("full");
            });

            test("returns 'full' when inner rect touches left and top edges", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("full");
            });

            test("returns 'full' when inner rect touches right and bottom edges", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 50, y: 50, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("full");
            });
        });

        describe("partial containment", () => {
            test("returns 'partial' when inner rect overlaps left edge", () => {
                const outer = { x: 50, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 25, width: 75, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'partial' when inner rect overlaps right edge", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 75, y: 25, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'partial' when inner rect overlaps top edge", () => {
                const outer = { x: 0, y: 50, width: 100, height: 100 };
                const inner = { x: 25, y: 0, width: 50, height: 75 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'partial' when inner rect overlaps bottom edge", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 25, y: 75, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'partial' when inner rect overlaps corner", () => {
                const outer = { x: 50, y: 50, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 75, height: 75 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'partial' when inner rect is larger and contains outer", () => {
                const outer = { x: 50, y: 50, width: 50, height: 50 };
                const inner = { x: 0, y: 0, width: 200, height: 200 };
                expect(rectContainsRect(outer, inner)).toBe("partial");
            });

            test("returns 'none' when rects share one edge (touching but not overlapping)", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 100, y: 0, width: 100, height: 100 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });
        });

        describe("no containment", () => {
            test("returns 'none' when rects do not overlap", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 200, y: 200, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when inner rect is to the right", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 101, y: 0, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when inner rect is below", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 101, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when inner rect is to the left", () => {
                const outer = { x: 100, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 99, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when inner rect is above", () => {
                const outer = { x: 0, y: 100, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 50, height: 99 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });
        });

        describe("invalid rectangles", () => {
            test("returns 'none' when outer rect has infinite x", () => {
                const outer = { x: Infinity, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when inner rect has NaN width", () => {
                const outer = { x: 0, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: 0, width: NaN, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when outer rect has negative infinity height", () => {
                const outer = { x: 0, y: 0, width: 100, height: -Infinity };
                const inner = { x: 0, y: 0, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });

            test("returns 'none' when both rects are invalid", () => {
                const outer = { x: NaN, y: 0, width: 100, height: 100 };
                const inner = { x: 0, y: Infinity, width: 50, height: 50 };
                expect(rectContainsRect(outer, inner)).toBe("none");
            });
        });
    });

    describe("rotateRect", () => {
        test("returns same rect when rotation is 0", () => {
            const rect = { x: 10, y: 20, width: 100, height: 50 };
            const result = rotateRect(rect, 0);
            expect(result.x).toBeCloseTo(10, 5);
            expect(result.y).toBeCloseTo(20, 5);
            expect(result.width).toBeCloseTo(100, 5);
            expect(result.height).toBeCloseTo(50, 5);
        });

        test("rotates rect 90 degrees around top-left corner", () => {
            const rect = { x: 0, y: 0, width: 100, height: 50 };
            const result = rotateRect(rect, Math.PI / 2); // 90 degrees
            expect(result.x).toBeCloseTo(0, 5);
            expect(result.y).toBeCloseTo(-100, 5);
            expect(result.width).toBeCloseTo(50, 5);
            expect(result.height).toBeCloseTo(100, 5);
        });

        test("rotates rect 180 degrees around top-left corner", () => {
            const rect = { x: 0, y: 0, width: 100, height: 50 };
            const result = rotateRect(rect, Math.PI); // 180 degrees
            expect(result.x).toBeCloseTo(-100, 5);
            expect(result.y).toBeCloseTo(-50, 5);
            expect(result.width).toBeCloseTo(100, 5);
            expect(result.height).toBeCloseTo(50, 5);
        });

        test("rotates rect 45 degrees around top-left corner", () => {
            const rect = { x: 0, y: 0, width: 100, height: 100 };
            const result = rotateRect(rect, Math.PI / 4); // 45 degrees
            const expectedSize = 100 * Math.sqrt(2);
            expect(result.width).toBeCloseTo(expectedSize, 5);
            expect(result.height).toBeCloseTo(expectedSize, 5);
        });

        test("rotates rect around custom center point", () => {
            const rect = { x: 0, y: 0, width: 100, height: 100 };
            const center = [50, 50]; // Center of the rect
            const result = rotateRect(rect, Math.PI / 2, center); // 90 degrees
            expect(result.x).toBeCloseTo(0, 5);
            expect(result.y).toBeCloseTo(0, 5);
            expect(result.width).toBeCloseTo(100, 5);
            expect(result.height).toBeCloseTo(100, 5);
        });

        test("handles negative rotation", () => {
            const rect = { x: 0, y: 0, width: 100, height: 50 };
            const result = rotateRect(rect, -Math.PI / 2); // -90 degrees
            expect(result.x).toBeCloseTo(-50, 5);
            expect(result.y).toBeCloseTo(0, 5);
            expect(result.width).toBeCloseTo(50, 5);
            expect(result.height).toBeCloseTo(100, 5);
        });

        test("preserves position offset when rotating", () => {
            const rect = { x: 100, y: 200, width: 50, height: 50 };
            const result = rotateRect(rect, Math.PI / 2);
            expect(result.x).toBeCloseTo(100, 5);
            expect(result.y).toBeCloseTo(150, 5);
        });
    });

    describe("rotateTranslation", () => {
        test("returns same translation when rotation is 0", () => {
            const translation = [100, 50];
            const result = rotateTranslation(translation, 0);
            expect(result[0]).toBeCloseTo(100, 5);
            expect(result[1]).toBeCloseTo(50, 5);
        });

        test("rotates translation 90 degrees", () => {
            const translation = [100, 0];
            const result = rotateTranslation(translation, Math.PI / 2);
            expect(result[0]).toBeCloseTo(0, 5);
            expect(result[1]).toBeCloseTo(-100, 5);
        });

        test("rotates translation 180 degrees", () => {
            const translation = [100, 50];
            const result = rotateTranslation(translation, Math.PI);
            expect(result[0]).toBeCloseTo(-100, 5);
            expect(result[1]).toBeCloseTo(-50, 5);
        });

        test("rotates translation 270 degrees", () => {
            const translation = [100, 0];
            const result = rotateTranslation(translation, (3 * Math.PI) / 2);
            expect(result[0]).toBeCloseTo(0, 5);
            expect(result[1]).toBeCloseTo(100, 5);
        });

        test("handles negative rotation", () => {
            const translation = [100, 0];
            const result = rotateTranslation(translation, -Math.PI / 2);
            expect(result[0]).toBeCloseTo(0, 5);
            expect(result[1]).toBeCloseTo(100, 5);
        });

        test("rotates translation 45 degrees", () => {
            const translation = [100, 0];
            const result = rotateTranslation(translation, Math.PI / 4);
            const expected = 100 / Math.sqrt(2);
            expect(result[0]).toBeCloseTo(expected, 5);
            expect(result[1]).toBeCloseTo(-expected, 5);
        });
    });

    describe("unionRect", () => {
        test("merges two non-overlapping rects", () => {
            const rect1 = { x: 0, y: 0, width: 50, height: 50 };
            const rect2 = { x: 100, y: 100, width: 50, height: 50 };
            const result = unionRect(rect1, rect2);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
            expect(result.width).toBe(150);
            expect(result.height).toBe(150);
        });

        test("merges two overlapping rects", () => {
            const rect1 = { x: 0, y: 0, width: 100, height: 100 };
            const rect2 = { x: 50, y: 50, width: 100, height: 100 };
            const result = unionRect(rect1, rect2);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
            expect(result.width).toBe(150);
            expect(result.height).toBe(150);
        });

        test("returns parent rect when child is invalid", () => {
            const child = { x: NaN, y: 0, width: 50, height: 50 };
            const parent = { x: 0, y: 0, width: 100, height: 100 };
            const result = unionRect(child, parent);
            expect(result).toEqual(parent);
            expect(result).not.toBe(parent); // Should be a copy
        });

        test("returns child rect when parent is invalid", () => {
            const child = { x: 0, y: 0, width: 50, height: 50 };
            const parent = { x: 0, y: Infinity, width: 100, height: 100 };
            const result = unionRect(child, parent);
            expect(result).toEqual(child);
            expect(result).not.toBe(child); // Should be a copy
        });

        test("handles rect with negative coordinates", () => {
            const rect1 = { x: -50, y: -50, width: 100, height: 100 };
            const rect2 = { x: 0, y: 0, width: 100, height: 100 };
            const result = unionRect(rect1, rect2);
            expect(result.x).toBe(-50);
            expect(result.y).toBe(-50);
            expect(result.width).toBe(150);
            expect(result.height).toBe(150);
        });

        test("returns correct union when one rect contains the other", () => {
            const small = { x: 25, y: 25, width: 50, height: 50 };
            const large = { x: 0, y: 0, width: 100, height: 100 };
            const result = unionRect(small, large);
            expect(result).toEqual(large);
        });

        test("handles identical rects", () => {
            const rect = { x: 10, y: 20, width: 30, height: 40 };
            const result = unionRect(rect, rect);
            expect(result).toEqual(rect);
        });
    });

    describe("convertNumber", () => {
        describe("decimal numbers", () => {
            test("converts decimal integer string", () => {
                expect(convertNumber("123")).toBe(123);
            });

            test("converts decimal float string", () => {
                expect(convertNumber("123.456")).toBeCloseTo(123.456, 5);
            });

            test("converts negative decimal", () => {
                expect(convertNumber("-42")).toBe(-42);
            });

            test("converts negative float", () => {
                expect(convertNumber("-3.14")).toBeCloseTo(-3.14, 5);
            });

            test("converts zero", () => {
                expect(convertNumber("0")).toBe(0);
            });

            test("converts zero float", () => {
                expect(convertNumber("0.0")).toBe(0);
            });
        });

        describe("hexadecimal numbers", () => {
            test("converts hex with # prefix", () => {
                expect(convertNumber("#FF")).toBe(255);
            });

            test("converts hex with 0x prefix", () => {
                expect(convertNumber("0xFF")).toBe(255);
            });

            test("converts hex with 0X prefix (uppercase)", () => {
                expect(convertNumber("0XFF")).toBe(255);
            });

            test("converts hex with &h prefix", () => {
                expect(convertNumber("&hFF")).toBe(255);
            });

            test("converts hex with &H prefix (uppercase)", () => {
                expect(convertNumber("&HFF")).toBe(255);
            });

            test("converts larger hex number", () => {
                expect(convertNumber("#ABCDEF")).toBe(0xabcdef);
            });

            test("converts hex with lowercase letters", () => {
                expect(convertNumber("0xabcdef")).toBe(0xabcdef);
            });
        });

        describe("whitespace handling", () => {
            test("trims leading whitespace", () => {
                expect(convertNumber("  123")).toBe(123);
            });

            test("trims trailing whitespace", () => {
                expect(convertNumber("123  ")).toBe(123);
            });

            test("trims both leading and trailing whitespace", () => {
                expect(convertNumber("  123  ")).toBe(123);
            });
        });

        describe("invalid inputs", () => {
            test("returns NaN for empty string", () => {
                expect(convertNumber("")).toBeNaN();
            });

            test("returns NaN for whitespace-only string", () => {
                expect(convertNumber("   ")).toBeNaN();
            });

            test("returns NaN for non-numeric string", () => {
                expect(convertNumber("abc")).toBeNaN();
            });
        });
    });

    describe("convertLong", () => {
        describe("decimal longs", () => {
            test("converts decimal integer string", () => {
                const result = convertLong("123");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(123);
            });

            test("converts large decimal number", () => {
                const result = convertLong("9223372036854775807"); // Max int64
                expect(result).toBeDefined();
                expect(result.toString()).toBe("9223372036854775807");
            });

            test("converts zero", () => {
                const result = convertLong("0");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(0);
            });

            test("converts negative number", () => {
                const result = convertLong("-123");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(-123);
            });
        });

        describe("hexadecimal longs", () => {
            test("converts hex with # prefix", () => {
                const result = convertLong("#FF");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(255);
            });

            test("converts hex with 0x prefix", () => {
                const result = convertLong("0xFF");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(255);
            });

            test("converts hex with &h prefix", () => {
                const result = convertLong("&hFF");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(255);
            });

            test("converts large hex number", () => {
                const result = convertLong("#7FFFFFFFFFFFFFFF"); // Max int64 in hex
                expect(result).toBeDefined();
                expect(result.toString()).toBe("9223372036854775807");
            });
        });

        describe("whitespace handling", () => {
            test("trims leading whitespace", () => {
                const result = convertLong("  123");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(123);
            });

            test("trims trailing whitespace", () => {
                const result = convertLong("123  ");
                expect(result).toBeDefined();
                expect(result.toNumber()).toBe(123);
            });
        });

        describe("invalid inputs", () => {
            test("returns undefined for empty string", () => {
                expect(convertLong("")).toBeUndefined();
            });

            test("returns undefined for whitespace-only string", () => {
                expect(convertLong("   ")).toBeUndefined();
            });

            test("returns undefined for non-numeric string", () => {
                const result = convertLong("abc");
                expect(result).toBeUndefined();
            });
        });
    });

    describe("convertHexColor", () => {
        describe("6-digit hex colors", () => {
            test("converts #RRGGBB format", () => {
                expect(convertHexColor("#FF0000")).toBe(-16776961); // Red with FF alpha (0xff0000ff as signed int32)
            });

            test("converts 0xRRGGBB format", () => {
                expect(convertHexColor("0x00FF00")).toBe(0x00ff00ff); // Green with FF alpha
            });

            test("converts &hRRGGBB format", () => {
                expect(convertHexColor("&h0000FF")).toBe(0x0000ffff); // Blue with FF alpha
            });

            test("converts lowercase hex", () => {
                expect(convertHexColor("#abcdef")).toBe(-1412567041); // 0xabcdefff as signed int32
            });

            test("converts mixed case hex", () => {
                expect(convertHexColor("#AbCdEf")).toBe(-1412567041); // 0xabcdefff as signed int32
            });

            test("adds FF alpha to 6-digit colors", () => {
                expect(convertHexColor("123456")).toBe(0x123456ff);
            });
        });

        describe("8-digit hex colors with alpha", () => {
            test("preserves alpha channel in 8-digit format", () => {
                expect(convertHexColor("#FF000080")).toBe(-16777088); // Red with 50% alpha (0xff000080 as signed int32)
            });

            test("handles full alpha (opaque)", () => {
                expect(convertHexColor("#00FF00FF")).toBe(0x00ff00ff); // Green fully opaque
            });

            test("handles zero alpha (transparent)", () => {
                expect(convertHexColor("#0000FF00")).toBe(0x0000ff00); // Blue fully transparent
            });
        });

        describe("short format colors", () => {
            test("pads short colors with leading zeros", () => {
                expect(convertHexColor("#123")).toBe(0x000123ff);
            });

            test("pads single digit", () => {
                expect(convertHexColor("#F")).toBe(0x00000fff);
            });

            test("pads empty to black", () => {
                expect(convertHexColor("")).toBe(-1);
            });
        });

        describe("whitespace handling", () => {
            test("trims leading whitespace", () => {
                expect(convertHexColor("  #FF0000")).toBe(-16776961);
            });

            test("trims trailing whitespace", () => {
                expect(convertHexColor("#FF0000  ")).toBe(-16776961);
            });

            test("trims both leading and trailing whitespace", () => {
                expect(convertHexColor("  #FF0000  ")).toBe(-16776961);
            });
        });

        describe("invalid inputs", () => {
            test("returns -1 for empty string", () => {
                expect(convertHexColor("")).toBe(-1);
            });

            test("returns -1 for whitespace-only string", () => {
                expect(convertHexColor("   ")).toBe(-1);
            });

            test("returns -1 for invalid hex characters", () => {
                expect(convertHexColor("#GGGGGG")).toBe(-1);
            });
        });

        describe("various prefix formats", () => {
            test("handles uppercase 0X prefix", () => {
                expect(convertHexColor("0XFF0000")).toBe(-16776961);
            });

            test("handles uppercase &H prefix", () => {
                expect(convertHexColor("&HFF0000")).toBe(-16776961);
            });

            test("handles no prefix", () => {
                expect(convertHexColor("FF0000")).toBe(-16776961);
            });
        });
    });
});
