const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");

const { getComponentDefinitionMap } = scenegraph;

describe("ComponentDefinition script tag parsing", () => {
    const xmlPath = "pkg:/components/TestComponent.xml";

    function createMockFS(componentXml) {
        return {
            existsSync: jest.fn(() => true),
            findSync: jest.fn((uri, ext) => {
                if (ext === "xml") {
                    return [xmlPath];
                }
                return [];
            }),
            readFileSync: jest.fn((path) => {
                if (path === xmlPath) {
                    return componentXml;
                }
                return "";
            }),
        };
    }

    test('self-closing <script uri="..." /> sets uri property', () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript" uri="test.brs" />
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].uri).toMatch(/test\.brs$/);
        expect(component.scripts[0].content).toBeUndefined();
    });

    test("non-self-closing with uri and newline body treats as external only", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript" uri="test.brs">
    </script>
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].uri).toMatch(/test\.brs$/);
        expect(component.scripts[0].content).toBeUndefined();
    });

    test("non-self-closing with uri and whitespace body treats as external only", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript" uri="test.brs">   </script>
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].uri).toMatch(/test\.brs$/);
        expect(component.scripts[0].content).toBeUndefined();
    });

    test("inline CDATA content sets content property", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript"><![CDATA[sub init()
end sub]]></script>
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(1);
        expect(component.scripts[0].content).toContain("sub init()");
        expect(component.scripts[0].uri).toBeUndefined();
    });

    test("both uri and CDATA content throws error", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript" uri="test.brs"><![CDATA[sub init()
end sub]]></script>
</component>`;
        expect(() => getComponentDefinitionMap(createMockFS(xml))).toThrow(
            /script.*element cannot contain both internal and external source/
        );
    });

    test("whitespace-only body with no uri produces empty scripts", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript">   </script>
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(0);
    });

    test("empty body with no uri produces empty scripts", () => {
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<component name="TestComponent" extends="Scene">
    <script type="text/brightscript"></script>
</component>`;
        const components = getComponentDefinitionMap(createMockFS(xml));
        const component = components.get("testcomponent");
        expect(component).toBeDefined();
        expect(component.scripts).toHaveLength(0);
    });
});
