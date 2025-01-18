const brs = require("../../../bin/brs.node");
const { Interpreter } = brs;
const { BrsString, RoXMLElement } = brs.types;

brs.registerCallback(() => {}); // register a callback to avoid display errors

describe("RoXMLElement", () => {
    let xmlParser;
    let interpreter;

    beforeEach(() => {
        xmlParser = new RoXMLElement();
        interpreter = new Interpreter();
    });

    describe("test methods for object with successful parsed xml", () => {
        beforeEach(() => {
            let parse = xmlParser.getMethod("parse");
            parse.call(interpreter, new BrsString(getXmlString()));
        });

        it("getName", async () => {
            let getName = xmlParser.getMethod("getName");
            expect(await getName.call(interpreter)).toEqual(new BrsString("tag1"));
        });

        it("getNamedElementsCi", async () => {
            let getNamedElementsCi = xmlParser.getMethod("getNamedElementsCi");
            expect(
                (await getNamedElementsCi.call(interpreter, new BrsString("any"))).getElements()
            ).toEqual([]);

            let children = await getNamedElementsCi.call(interpreter, new BrsString("CHiLd1"));
            expect(children.getElements().length).toEqual(2);

            let getName = children.getElements()[0].getMethod("getName");
            expect(await getName.call(interpreter)).toEqual(new BrsString("Child1"));

            getName = children.getElements()[1].getMethod("getName");
            expect(await getName.call(interpreter)).toEqual(new BrsString("CHILD1"));
        });

        it("getAttributes", async () => {
            let getAttributes = xmlParser.getMethod("getAttributes");
            expect((await getAttributes.call(interpreter)).elements).not.toEqual(new Map());
            expect((await getAttributes.call(interpreter)).elements).toEqual(
                new Map([
                    ["id", new BrsString("someId")],
                    ["attr1", new BrsString("0")],
                ])
            );
        });
    });

    describe.each([
        ["test methods for object with no parsed xml", () => {}],
        [
            "test methods for object with failed parsing of xml",
            async () => {
                let parse = xmlParser.getMethod("parse");
                await parse.call(
                    interpreter,
                    new BrsString('>bad_tag id="12" <  some text >/bad_tag<')
                );
            },
        ],
    ])("%s", (name, tryParse) => {
        beforeEach(() => {
            tryParse();
        });

        it("getName", async () => {
            let getName = xmlParser.getMethod("getName");
            expect(getName).toBeTruthy();
            expect(await getName.call(interpreter)).toEqual(new BrsString(""));
        });

        it("getNamedElementsCi", async () => {
            let getNamedElementsCi = xmlParser.getMethod("getNamedElementsCi");
            expect(getNamedElementsCi).toBeTruthy();
            expect(
                (await getNamedElementsCi.call(interpreter, new BrsString("any"))).getElements()
            ).toEqual([]);
        });

        it("getAttributes", async () => {
            let getAttributes = xmlParser.getMethod("getAttributes");
            expect(getAttributes).toBeTruthy();
            expect((await getAttributes.call(interpreter)).elements).toEqual(new Map());
        });
    });

    describe("test parse method with different xml strings", () => {
        test.each([
            ["<tag>some text<tag>", false],
            ["<tag>some text</tag>", true],
            ["<tag>some text <child1> child's text </child1> </tag>", true],
            [getXmlString(), true],
            ['>bad_tag id="12" <  some text >/bad_tag<', false],
            ["", false],
        ])("test parse with string %s", async (xmlString, expected) => {
            let parse = xmlParser.getMethod("parse");
            expect((await parse.call(interpreter, new BrsString(xmlString))).value).toBe(expected);
        });
    });
    it.todo("add tests for all remaining methods");
});

function getXmlString() {
    return '<tag1 id="someId" attr1="0"> <Child1 id="id1"></Child1> <CHILD1 id="id2"></CHILD1> </tag1>';
}
