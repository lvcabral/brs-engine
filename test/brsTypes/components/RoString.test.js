const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { Int32, Float, BrsString, RoString, RoArray, RoList, BrsBoolean, Callable } = brs.types;

describe("RoString", () => {
    describe("constructor", () => {
        it("starts with empty string when no arg is passed to constructor", async () => {
            let a = new RoString();
            expect(a.equalTo(new BrsString(""))).toBe(BrsBoolean.True);
        });
    });

    describe("equality", () => {
        it("compares to intrinsic strings", () => {
            let a = new RoString(new BrsString("foo"));
            let b = new BrsString("foo");
            let c = new BrsString("bar");

            expect(a.equalTo(b)).toBe(BrsBoolean.True);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
        });

        it("compares to boxed strings", () => {
            let a = new RoString(new BrsString("foo"));
            let b = new RoString(new BrsString("foo"));
            let c = new RoString(new BrsString("bar"));

            expect(a.equalTo(b)).toBe(BrsBoolean.True);
            expect(a.equalTo(c)).toBe(BrsBoolean.False);
        });
    });

    test("toString", () => {
        expect(new RoString(new BrsString("A1b2C#☃︎")).toString()).toBe("A1b2C#☃︎");
    });

    describe("ifString", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("setString", () => {
            let s, setString;

            beforeEach(() => {
                s = new RoString(new BrsString("before"));
                setString = s.getMethod("setString");
                expect(setString).toBeInstanceOf(Callable);
            });

            it("sets a string into the object", async () => {
                await setString.call(interpreter, new BrsString("hello"));
                expect(s.intrinsic).toEqual(new BrsString("hello"));
            });

            it("overwrites string value previously set", async () => {
                await setString.call(interpreter, new BrsString("hello"));
                await setString.call(interpreter, new BrsString("world"));
                expect(s.intrinsic).toEqual(new BrsString("world"));
            });
        });

        test("getString", async () => {
            let s = new RoString(new BrsString("hello"));
            getString = s.getMethod("getString");
            expect(getString).toBeInstanceOf(Callable);
            expect(await getString.call(interpreter)).toEqual(new BrsString("hello"));
        });
    });

    describe("ifStringOps", () => {
        let interpreter;

        beforeEach(() => {
            interpreter = new Interpreter();
        });

        describe("appendString", () => {
            let s, appendString;

            beforeEach(() => {
                s = new RoString(new BrsString("before"));
                appendString = s.getMethod("appendString");
                expect(appendString).toBeInstanceOf(Callable);
            });

            it("appends positive `len` characters", async () => {
                await appendString.call(interpreter, new BrsString("after"), new Int32(3));
                expect(s.intrinsic).toEqual(new BrsString("beforeaft"));
            });

            it("appends nothing for zero `len`", async () => {
                await appendString.call(interpreter, new BrsString("after"), new Int32(0));
                expect(s.intrinsic).toEqual(new BrsString("before"));
            });

            it("appends nothing for negative `len`", async () => {
                await appendString.call(interpreter, new BrsString("after"), new Int32(-1));
                expect(s.intrinsic).toEqual(new BrsString("before"));
            });
        });

        describe("len", () => {
            it("returns the length of the intrinsic string", async () => {
                let s = new RoString(new BrsString("☃☃☃"));
                let len = s.getMethod("len");
                expect(len).toBeInstanceOf(Callable);
                expect(await len.call(interpreter)).toEqual(new Int32(3));
            });
        });

        describe("left", () => {
            let left;

            beforeEach(() => {
                let s = new RoString(new BrsString("☃ab"));
                left = s.getMethod("left");
                expect(left).toBeInstanceOf(Callable);
            });

            it("returns the entire string for `len` greater than string length", async () => {
                expect(await left.call(interpreter, new Int32(500))).toEqual(new BrsString("☃ab"));
            });

            it("returns the first `len` characters for positive `len`", async () => {
                expect(await left.call(interpreter, new Int32(2))).toEqual(new BrsString("☃a"));
            });

            it("returns an empty string for non-positive `len`", async () => {
                expect(await left.call(interpreter, new Int32(0))).toEqual(new BrsString(""));
                expect(await left.call(interpreter, new Int32(-25))).toEqual(new BrsString(""));
            });
        });

        describe("right", () => {
            let right;

            beforeEach(() => {
                let s = new RoString(new BrsString("☃ab"));
                right = s.getMethod("right");
                expect(right).toBeInstanceOf(Callable);
            });

            it("returns the entire string for `len` greater than string length", async () => {
                expect(await right.call(interpreter, new Int32(500))).toEqual(new BrsString("☃ab"));
            });

            it("returns the last `len` characters for positive `len`", async () => {
                expect(await right.call(interpreter, new Int32(2))).toEqual(new BrsString("ab"));
            });

            it("returns an empty string for non-positive `len`", async () => {
                expect(await right.call(interpreter, new Int32(0))).toEqual(new BrsString(""));
                expect(await right.call(interpreter, new Int32(-25))).toEqual(new BrsString(""));
            });
        });

        describe("mid", () => {
            let mid;

            beforeEach(() => {
                //                                  0   0   0   1   1   2   2
                //                                  0   4   8   2   6   0   4
                let s = new RoString(new BrsString("Lorem ipsum dolor sit aMeT"));
                mid = s.getMethod("mid");
                expect(mid).toBeInstanceOf(Callable);
            });

            describe("without `len`", () => {
                it("returns all characters after positive `start_point`", async () => {
                    expect(await mid.call(interpreter, new Int32(12))).toEqual(
                        new BrsString("dolor sit aMeT")
                    );
                });

                it("returns entire string for zero `start_point`", async () => {
                    expect(await mid.call(interpreter, new Int32(0))).toEqual(
                        new BrsString("Lorem ipsum dolor sit aMeT")
                    );
                });

                it("returns entire string for negative `start_point`", async () => {
                    expect(await mid.call(interpreter, new Int32(-30))).toEqual(
                        new BrsString("Lorem ipsum dolor sit aMeT")
                    );
                });

                it("returns empty string for `start_point` greater than string length", async () => {
                    expect(await mid.call(interpreter, new Int32(26))).toEqual(new BrsString(""));
                });
            });

            describe("with `len`", () => {
                it("returns `len` characters after positive `start_point`", async () => {
                    expect(await mid.call(interpreter, new Int32(12), new Int32(7))).toEqual(
                        new BrsString("dolor s")
                    );
                });

                it("returns string starting at 0 for negative `start_point` and positive `len`", async () => {
                    expect(await mid.call(interpreter, new Int32(-30), new Int32(7))).toEqual(
                        new BrsString("Lorem i")
                    );
                });

                it("returns empty string for negative `start_point` and negative `len`", async () => {
                    expect(await mid.call(interpreter, new Int32(-30), new Int32(-9))).toEqual(
                        new BrsString("")
                    );
                });

                it("returns empty string for `start_point` greater than string length", async () => {
                    expect(await mid.call(interpreter, new Int32(26), new Int32(5))).toEqual(
                        new BrsString("")
                    );
                });
            });
        });

        describe("instr", () => {
            let instr;

            beforeEach(() => {
                //                                  0   0   0   1   1   2   2
                //                                  0   4   8   2   6   0   4
                let s = new RoString(new BrsString("Monday, Tuesday, Happy Days"));
                instr = s.getMethod("instr");
                expect(instr).toBeInstanceOf(Callable);
            });

            describe("without start_index", () => {
                it("returns the index of the first occurrence", async () => {
                    expect(await instr.call(interpreter, new BrsString("day"))).toEqual(
                        new Int32(3)
                    );
                });

                it("returns -1 for not-found substrings", async () => {
                    expect(await instr.call(interpreter, new BrsString("Fonzie"))).toEqual(
                        new Int32(-1)
                    );
                });

                it("returns 0 for empty substrings", async () => {
                    expect(await instr.call(interpreter, new BrsString(""))).toEqual(new Int32(0));
                });
            });

            describe("with start_index", () => {
                it("returns the index of the first occurrence after `start_index`", async () => {
                    expect(
                        await instr.call(interpreter, new Int32(5), new BrsString("day"))
                    ).toEqual(new Int32(12));
                });

                it("returns -1 for not-found substrings", async () => {
                    expect(
                        await instr.call(interpreter, new Int32(5), new BrsString("Monday"))
                    ).toEqual(new Int32(-1));
                });

                it("returns start_index (when positive) for empty substrings", async () => {
                    expect(
                        await instr.call(interpreter, new Int32(111), new BrsString(""))
                    ).toEqual(new Int32(111));
                });
                it("returns 0 (when star_index is negative) for empty substrings", async () => {
                    expect(await instr.call(interpreter, new Int32(-1), new BrsString(""))).toEqual(
                        new Int32(0)
                    );
                });
            });
        });

        describe("replace", () => {
            let replace;

            beforeEach(() => {
                let s = new RoString(new BrsString("tossed salad and scrambled eggs"));
                replace = s.getMethod("replace");
                expect(replace).toBeInstanceOf(Callable);
            });

            it("replaces all instances of `from` with `to`", async () => {
                expect(
                    await replace.call(interpreter, new BrsString("s"), new BrsString("$"))
                ).toEqual(new BrsString("to$$ed $alad and $crambled egg$"));
            });

            it("returns the original string for empty `from`", async () => {
                expect(
                    await replace.call(
                        interpreter,
                        new BrsString(""),
                        new BrsString("oh baby I hear the blues a-callin'")
                    )
                ).toEqual(new BrsString("tossed salad and scrambled eggs"));
            });

            it("escapes strings with reserved regex characters", async () => {
                let s = new RoString(new BrsString("oh baby {1}"));
                replace = s.getMethod("replace");
                expect(
                    await replace.call(
                        interpreter,
                        new BrsString("{1}"),
                        new BrsString("I hear the blues a-callin'")
                    )
                ).toEqual(new BrsString("oh baby I hear the blues a-callin'"));
            });
        });

        describe("trim", () => {
            let trim;

            beforeEach(() => {
                let whitespace = [
                    String.fromCharCode(0x0a), // newline
                    String.fromCharCode(0x0b), // vertical tab
                    String.fromCharCode(0x0c), // form feed
                    String.fromCharCode(0x0d), // carriage return
                    String.fromCharCode(0xa0), // non-breaking space
                    "\t", // just a regular tab
                    " ", // just a regular space
                ].join("");

                let s = new RoString(new BrsString(whitespace + "hello" + whitespace));
                trim = s.getMethod("trim");
                expect(trim).toBeInstanceOf(Callable);
            });

            it("removes leading and trailing whitespace", async () => {
                expect(await trim.call(interpreter)).toEqual(new BrsString("hello"));
            });
        });

        describe("toInt", () => {
            it("returns 0 for non-numbers", async () => {
                let s = new RoString(new BrsString("I'm just a bill."));
                let toInt = s.getMethod("toInt");
                expect(toInt).toBeInstanceOf(Callable);

                expect(await toInt.call(interpreter)).toEqual(new Int32(0));
            });

            it("returns 0 for hex strings", async () => {
                let s = new RoString(new BrsString("&hFF"));
                let toInt = s.getMethod("toInt");
                expect(toInt).toBeInstanceOf(Callable);

                expect(await toInt.call(interpreter)).toEqual(new Int32(0));
            });

            it("converts string-formatted integers to Integer type", async () => {
                let s = new RoString(new BrsString("112358"));
                let toInt = s.getMethod("toInt");
                expect(toInt).toBeInstanceOf(Callable);

                expect(await toInt.call(interpreter)).toEqual(new Int32(112358));
            });

            it("truncates string-formatted floats to Integer type", async () => {
                let negative = new RoString(new BrsString("-1.9"));
                let negativeToInt = negative.getMethod("toInt");
                expect(negativeToInt).toBeInstanceOf(Callable);
                expect(await negativeToInt.call(interpreter)).toEqual(new Int32(-1));

                let positive = new RoString(new BrsString("1.9"));
                let positiveToInt = positive.getMethod("toInt");
                expect(positiveToInt).toBeInstanceOf(Callable);
                expect(await positiveToInt.call(interpreter)).toEqual(new Int32(1));
            });
        });

        describe("toFloat", () => {
            it("returns 0 for non-numbers", async () => {
                let s = new RoString(new BrsString("I'm just a bill."));
                let toFloat = s.getMethod("toFloat");
                expect(toFloat).toBeInstanceOf(Callable);

                expect(await toFloat.call(interpreter)).toEqual(new Float(0));
            });

            it("returns 0 for hex strings", async () => {
                let s = new RoString(new BrsString("&hFF"));
                let toFloat = s.getMethod("toFloat");
                expect(toFloat).toBeInstanceOf(Callable);

                expect(await toFloat.call(interpreter)).toEqual(new Float(0));
            });

            it("converts string-formatted integers to Float type", async () => {
                let s = new RoString(new BrsString("112358"));
                let toFloat = s.getMethod("toFloat");
                expect(toFloat).toBeInstanceOf(Callable);

                expect(await toFloat.call(interpreter)).toEqual(new Float(112358));
            });

            it("converts string-formatted floats to Float type", async () => {
                let negative = new RoString(new BrsString("-1.9"));
                let negativeToFloat = negative.getMethod("toFloat");
                expect(negativeToFloat).toBeInstanceOf(Callable);
                expect(await negativeToFloat.call(interpreter)).toEqual(new Float(-1.9));

                let positive = new RoString(new BrsString("1.9"));
                let positiveToFloat = positive.getMethod("toFloat");
                expect(positiveToFloat).toBeInstanceOf(Callable);
                expect(await positiveToFloat.call(interpreter)).toEqual(new Float(1.9));
            });
        });

        describe("tokenize", () => {
            let tokenize;

            beforeEach(() => {
                let s = new RoString(new BrsString("🐶good dog🐶"));
                tokenize = s.getMethod("tokenize");
                expect(tokenize).toBeInstanceOf(Callable);
            });

            it("splits characters with an empty string", async () => {
                let result = await tokenize.call(interpreter, new BrsString(""));
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([new BrsString("🐶good dog🐶")]);
            });

            it("returns one section for not-found delimiters", async () => {
                let result = await tokenize.call(interpreter, new BrsString("/"));
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([new BrsString("🐶good dog🐶")]);
            });

            it("split with leading and trailing matches", async () => {
                let result = await tokenize.call(interpreter, new BrsString("🐶"));
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([new BrsString("good dog")]);
            });

            it("splits on multi-character sequences", async () => {
                let result = await tokenize.call(interpreter, new BrsString("oo"));
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("🐶g"),
                    new BrsString("d d"),
                    new BrsString("g🐶"),
                ]);
            });

            it("splits on different character delimiters", async () => {
                let result = await tokenize.call(interpreter, new BrsString("o "));
                expect(result).toBeInstanceOf(RoList);
                expect(result.elements).toEqual([
                    new BrsString("🐶g"),
                    new BrsString("d"),
                    new BrsString("d"),
                    new BrsString("g🐶"),
                ]);
            });
        });

        describe("seString", () => {
            let s, setString;

            beforeEach(() => {
                s = new RoString(new BrsString("before"));
                setString = s.getMethod("setString");
                expect(setString).toBeInstanceOf(Callable);
            });

            it("overwrites its stored string", async () => {
                await setString.call(interpreter, new BrsString("after"), new Int32(2));
                expect(s.intrinsic).toEqual(new BrsString("af"));
            });

            it("overwrites an empty string for zero `len`", async () => {
                await setString.call(interpreter, new BrsString("after"), new Int32(0));
                expect(s.intrinsic).toEqual(new BrsString(""));
            });

            it("overwrites an empty string for negative `len`", async () => {
                await setString.call(interpreter, new BrsString("after"), new Int32(-1));
                expect(s.intrinsic).toEqual(new BrsString(""));
            });
        });

        describe("split", () => {
            let split;

            beforeEach(() => {
                let s = new RoString(new BrsString("🐶good dog🐶"));
                split = s.getMethod("split");
                expect(split).toBeInstanceOf(Callable);
            });

            it("splits characters with an empty string", async () => {
                let result = await split.call(interpreter, new BrsString(""));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual(
                    ["🐶", "g", "o", "o", "d", " ", "d", "o", "g", "🐶"].map(
                        (c) => new BrsString(c)
                    )
                );
            });

            it("returns one section for not-found delimiters", async () => {
                let result = await split.call(interpreter, new BrsString("/"));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([new BrsString("🐶good dog🐶")]);
            });

            it("returns empty strings for leading and trailing matches", async () => {
                let result = await split.call(interpreter, new BrsString("🐶"));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([
                    new BrsString(""),
                    new BrsString("good dog"),
                    new BrsString(""),
                ]);
            });

            it("splits on multi-character sequences", async () => {
                let result = await split.call(interpreter, new BrsString("oo"));
                expect(result).toBeInstanceOf(RoArray);
                expect(result.elements).toEqual([new BrsString("🐶g"), new BrsString("d dog🐶")]);
            });
        });

        describe("getEntityEncode", () => {
            it("escapes five special characters", async () => {
                let s = new RoString(
                    new BrsString(`Let's watch <a href="example.com">Cagney & Lacey</a>!`)
                );
                let getEntityEncode = s.getMethod("getEntityEncode");
                expect(getEntityEncode).toBeInstanceOf(Callable);

                expect(await getEntityEncode.call(interpreter)).toEqual(
                    new BrsString(
                        String.raw`Let\'s watch \<a href=\"example.com\"\>Cagney \& Lacey\</a\>!`
                    )
                );
            });
        });

        describe("escape", () => {
            it("escapes characters in the ascii range", async () => {
                let s = new RoString(new BrsString("@&=+/#!*ABcde_-"));
                let escape = s.getMethod("escape");
                expect(escape).toBeInstanceOf(Callable);

                expect(await escape.call(interpreter)).toEqual(
                    new BrsString("%40%26%3D%2B%2F%23%21%2AABcde_-")
                );
            });

            it("breaks unicode characters into UTF-8 escape sequences", async () => {
                let s = new RoString(new BrsString("•"));
                let escape = s.getMethod("escape");
                expect(escape).toBeInstanceOf(Callable);

                expect(await escape.call(interpreter)).toEqual(new BrsString("%E2%80%A2"));
            });
        });

        describe("unescape", () => {
            it("unescapes characters in the ascii range", async () => {
                let s = new RoString(new BrsString("%40%26%3D%2B%2F%23%21%2AABcde_-"));
                let unescape = s.getMethod("unescape");
                expect(unescape).toBeInstanceOf(Callable);

                expect(await unescape.call(interpreter)).toEqual(new BrsString("@&=+/#!*ABcde_-"));
            });

            it("combines UTF-8 escape sequences into non-ASCII characters", async () => {
                let s = new RoString(new BrsString("%E2%80%A2"));
                let unescape = s.getMethod("unescape");
                expect(unescape).toBeInstanceOf(Callable);

                expect(await unescape.call(interpreter)).toEqual(new BrsString("•"));
            });
        });

        describe("encodeUri", () => {
            it("URI-encodes ASCII strings", async () => {
                let s = new RoString(
                    new BrsString("http://example.com/my test.asp?first=jane&last=doe")
                );
                let encodeUri = s.getMethod("encodeUri");
                expect(encodeUri).toBeInstanceOf(Callable);

                expect(await encodeUri.call(interpreter)).toEqual(
                    new BrsString("http://example.com/my%20test.asp?first=jane&last=doe")
                );
            });

            it("encodes non-ascii strings as UTF-8 escape sequences", async () => {
                let s = new RoString(new BrsString("http://example.com/?bullet=•"));
                let encodeUri = s.getMethod("encodeUri");
                expect(encodeUri).toBeInstanceOf(Callable);

                expect(await encodeUri.call(interpreter)).toEqual(
                    new BrsString("http://example.com/?bullet=%E2%80%A2")
                );
            });
        });

        describe("decodeUri", () => {
            it("URI-decodes ASCII strings", async () => {
                let s = new RoString(
                    new BrsString("http://example.com/my%20test.asp?first=jane&last=doe")
                );
                let decodeUri = s.getMethod("decodeUri");
                expect(decodeUri).toBeInstanceOf(Callable);

                expect(await decodeUri.call(interpreter)).toEqual(
                    new BrsString("http://example.com/my test.asp?first=jane&last=doe")
                );
            });

            it("decodes UTF-8 escape sequences into non-ASCII characters", async () => {
                let s = new RoString(new BrsString("http://example.com/?bullet=%E2%80%A2"));
                let decodeUri = s.getMethod("decodeUri");
                expect(decodeUri).toBeInstanceOf(Callable);

                expect(await decodeUri.call(interpreter)).toEqual(
                    new BrsString("http://example.com/?bullet=•")
                );
            });
        });

        describe("encodeUriComponent", () => {
            it("encodes the string for use as a URI component", async () => {
                let s = new RoString(
                    new BrsString("http://example.com/my test.asp?first=jane&last=doe")
                );
                let encodeUriComponent = s.getMethod("encodeUriComponent");
                expect(encodeUriComponent).toBeInstanceOf(Callable);

                expect(await encodeUriComponent.call(interpreter)).toEqual(
                    new BrsString(
                        "http%3A%2F%2Fexample.com%2Fmy%20test.asp%3Ffirst%3Djane%26last%3Ddoe"
                    )
                );
            });

            it("encodes non-ascii strings as UTF-8 escape sequences", async () => {
                let s = new RoString(new BrsString("http://example.com/?bullet=•"));
                let encodeUriComponent = s.getMethod("encodeUriComponent");
                expect(encodeUriComponent).toBeInstanceOf(Callable);

                expect(await encodeUriComponent.call(interpreter)).toEqual(
                    new BrsString("http%3A%2F%2Fexample.com%2F%3Fbullet%3D%E2%80%A2")
                );
            });
        });

        describe("decodeUriComponent", () => {
            it("decodes an encoded URI component to a readable string", async () => {
                let s = new RoString(
                    new BrsString(
                        "http%3A%2F%2Fexample.com%2Fmy%20test.asp%3Ffirst%3Djane%26last%3Ddoe"
                    )
                );
                let decodeUriComponent = s.getMethod("decodeUriComponent");
                expect(decodeUriComponent).toBeInstanceOf(Callable);

                expect(await decodeUriComponent.call(interpreter)).toEqual(
                    new BrsString("http://example.com/my test.asp?first=jane&last=doe")
                );
            });

            it("decodes UTF-8 escape sequences into non-ASCII characters", async () => {
                let s = new RoString(
                    new BrsString("http%3A%2F%2Fexample.com%2F%3Fbullet%3D%E2%80%A2")
                );
                let decodeUriComponent = s.getMethod("decodeUriComponent");
                expect(decodeUriComponent).toBeInstanceOf(Callable);

                expect(await decodeUriComponent.call(interpreter)).toEqual(
                    new BrsString("http://example.com/?bullet=•")
                );
            });
        });

        describe("startsWith and endsWith", () => {
            let s;
            beforeEach(() => {
                s = new RoString(new BrsString("Hello, World!"));
            });

            it("startsWith", async () => {
                let startsWith = s.getMethod("startsWith");
                expect(startsWith).toBeInstanceOf(Callable);
                expect(await startsWith.call(interpreter, new BrsString("Hello"))).toEqual(
                    BrsBoolean.True
                );
                expect(
                    await startsWith.call(interpreter, new BrsString("World"), new Int32(7))
                ).toEqual(BrsBoolean.True);
                expect(
                    await startsWith.call(interpreter, new BrsString("Universe"), new Int32(0))
                ).toEqual(BrsBoolean.False);
            });

            it("endsWith", async () => {
                let endsWith = s.getMethod("endsWith");
                expect(endsWith).toBeInstanceOf(Callable);
                expect(await endsWith.call(interpreter, new BrsString("World!"))).toEqual(
                    BrsBoolean.True
                );
                expect(
                    await endsWith.call(interpreter, new BrsString("Hello"), new Int32(5))
                ).toEqual(BrsBoolean.True);
                expect(
                    await endsWith.call(interpreter, new BrsString("Universe!"), new Int32(0))
                ).toEqual(BrsBoolean.False);
            });
        });

        describe("isEmpty", () => {
            it("check if empty string is empty", async () => {
                let s = new RoString(new BrsString(""));
                let len = s.getMethod("isEmpty");
                expect(len).toBeInstanceOf(Callable);
                expect(await len.call(interpreter)).toBe(BrsBoolean.True);
            });

            it("check if filled string is not empty", async () => {
                let s = new RoString(new BrsString("<3"));
                let len = s.getMethod("isEmpty");
                expect(len).toBeInstanceOf(Callable);
                expect(await len.call(interpreter)).toBe(BrsBoolean.False);
            });
        });
    });

    describe("ifToStr", () => {
        test("toStr", async () => {
            let s = new RoString(new BrsString("world"));
            let toStr = s.getMethod("toStr");

            expect(toStr).toBeInstanceOf(Callable);
            expect(await toStr.call(new Interpreter())).toEqual(new BrsString("world"));
        });
    });
});
