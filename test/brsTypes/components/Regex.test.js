const brs = require("brs");
const { BrsBoolean, BrsInvalid, BrsString, Int32, Regex, ValueKind } = brs.types;
const { Interpreter } = require("../../../lib/interpreter");

describe("Regex", () => {
    let interpreter;

    beforeEach(() => {
        interpreter = new Interpreter();
    });

    describe("isMatch", () => {
        it("matches strings with case sensitive flag", () => {
            let regx = new Regex(new BrsString("hello_[0-9]*_world"));
            let isMatch = regx.getMethod("isMatch");
            expect(isMatch).toBeTruthy();

            let str1 = isMatch.call(interpreter, new BrsString("hello_123_world"));
            expect(str1.kind).toBe(ValueKind.Boolean);
            expect(str1).toBe(BrsBoolean.True);

            let str2 = isMatch.call(interpreter, new BrsString("HeLlO_123_WoRlD"));
            expect(str2.kind).toBe(ValueKind.Boolean);
            expect(str2).toBe(BrsBoolean.False);
        });

        it("matches strings with case insensitive flag", () => {
            let regx = new Regex(new BrsString("hello_[0-9]*_world"), new BrsString("i"));
            let isMatch = regx.getMethod("isMatch");
            expect(isMatch).toBeTruthy();

            let str1 = isMatch.call(interpreter, new BrsString("HeLlO_123_WoRlD"));
            expect(str1.kind).toBe(ValueKind.Boolean);
            expect(str1).toBe(BrsBoolean.True);

            let str2 = isMatch.call(interpreter, new BrsString("HeLlO_XXX_WoRlD"));
            expect(str2.kind).toBe(ValueKind.Boolean);
            expect(str2).toBe(BrsBoolean.False);
        });

        it("matches a string in ISO8601 format", () => {
            let regx = new Regex(
                new BrsString("P(\\d+Y)?(\\d+M)?(\\d+D)?T(\\d+H)?(\\d+M)?(\\d+(.\\d+)?S)?")
            );
            let isMatch = regx.getMethod("isMatch");
            expect(isMatch).toBeTruthy();

            let str1 = isMatch.call(interpreter, new BrsString("P3Y6M4DT12H30M5S"));
            expect(str1.kind).toBe(ValueKind.Boolean);
            expect(str1).toBe(BrsBoolean.True);

            let str2 = isMatch.call(interpreter, new BrsString("P4Y5M2DT10H15M5.6S"));
            expect(str2.kind).toBe(ValueKind.Boolean);
            expect(str2).toBe(BrsBoolean.True);
        });
    });

    describe("match", () => {
        it("doesn't match string", () => {
            let rgx = new Regex(new BrsString("(a|(z))(bc)"));
            let match = rgx.getMethod("match");
            expect(match).toBeTruthy();

            let result = match.call(interpreter, new BrsString(""));
            let count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(0);
        });

        it("matches groups in string", () => {
            let rgx = new Regex(new BrsString("(a|(z))(bc)"));
            let match = rgx.getMethod("match");
            expect(match).toBeTruthy();

            let result = match.call(interpreter, new BrsString("abcd"));
            let count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(4);
            expect(result.get(new Int32(0)).value).toBe("abc"); //Entire match
            expect(result.get(new Int32(1)).value).toBe("a");
            expect(result.get(new Int32(2))).toEqual(BrsInvalid.Instance);
            expect(result.get(new Int32(3)).value).toBe("bc");
        });

        it("matches string in hh:mm:ss.ms date format", () => {
            let regx = new Regex(
                new BrsString("(([0-9]{2}):)?(([0-9]{2}):)?([0-9]{2})\\.([0-9]{3})")
            );
            let match = regx.getMethod("match");
            expect(match).toBeTruthy();

            let result = match.call(interpreter, new BrsString("10:35:15.123"));
            let count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(7);
        });

        it("matches strings using beginning and end of input", () => {
            let regx = new Regex(
                new BrsString("^(.*:)\\/\\/([A-Za-z0-9\\-\\.]+)?(:[0-9]+)?\\/?(.*)$")
            );
            let match = regx.getMethod("match");
            expect(match).toBeTruthy();

            let result = match.call(interpreter, new BrsString("http://regex101.com"));
            let count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(5);
            expect(result.get(new Int32(2)).value).toBe("regex101.com"); //Domain name

            result = match.call(interpreter, new BrsString("https://regex101.com"));
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(result.get(new Int32(1)).value).toBe("https:"); //Protocol

            result = match.call(interpreter, new BrsString("https:/regex101.com")); //Missing slash
            count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(0); //No matches
        });
    });

    describe("replace", () => {
        it("replaces first matched instance from string", () => {
            let rgx = new Regex(new BrsString("-"));
            let replace = rgx.getMethod("replace");
            expect(replace).toBeTruthy();

            let result = replace.call(interpreter, new BrsString("2010-01-01"), new BrsString("."));
            expect(result.kind).toBe(ValueKind.String);
            expect(result.value).toBe("2010.01-01");
        });

        it("replaces string by using positional replacement patterns", () => {
            let rgx = new Regex(new BrsString("S([0-9]+) E([0-9]+)"), new BrsString("i"));
            let replace = rgx.getMethod("replace");
            expect(replace).toBeTruthy();

            let result = replace.call(
                interpreter,
                new BrsString("S6 E9"),
                new BrsString("Season \\1 Episode \\2")
            );
            expect(result.kind).toBe(ValueKind.String);
            expect(result.value).toBe("Season 6 Episode 9");
        });
    });

    describe("replaceAll", () => {
        it("replaces all matched instances from string", () => {
            let rgx = new Regex(new BrsString("-"));
            let replaceAll = rgx.getMethod("replaceall");
            expect(replaceAll).toBeTruthy();

            let result = replaceAll.call(
                interpreter,
                new BrsString("2010-01-01"),
                new BrsString(".")
            );
            expect(result.kind).toBe(ValueKind.String);
            expect(result.value).toBe("2010.01.01");
        });
    });

    describe("split", () => {
        it("splits in the correct number of items", () => {
            let rgx = new Regex(new BrsString(","));
            let split = rgx.getMethod("split");
            expect(split).toBeTruthy();

            let result = split.call(interpreter, new BrsString("one, two, three, four"));
            let count = result.getMethod("count").call(interpreter);
            expect(result.kind).toBe(ValueKind.Object);
            expect(count.value).toBe(4);
        });
    });

    describe("matchAll", () => {
        it("matches all patterns in the string", () => {
            let rgx = new Regex(new BrsString("\\d+"));
            let matchAll = rgx.getMethod("matchall");
            expect(matchAll).toBeTruthy();

            let result = matchAll.call(interpreter, new BrsString("123 456 789"));
            let count = result.getMethod("count").call(interpreter);
            let firstElement = result.get(new Int32(0));
            let secondElement = result.get(new Int32(1));
            let thirdElement = result.get(new Int32(2));

            expect(result.kind).toBe(ValueKind.Object);
            expect(result.getComponentName()).toBe("roArray");
            expect(count.value).toBe(3);
            expect(firstElement.getComponentName()).toBe("roArray");
            expect(secondElement.getComponentName()).toBe("roArray");
            expect(thirdElement.getComponentName()).toBe("roArray");
            expect(firstElement.get(new Int32(0)).value).toBe("123");
            expect(secondElement.get(new Int32(0)).value).toBe("456");
            expect(thirdElement.get(new Int32(0)).value).toBe("789");
        });
    });
});
