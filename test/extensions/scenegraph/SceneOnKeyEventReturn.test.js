const scenegraph = require("../../../packages/scenegraph/lib/brs-sg.node.js");
const core = require("../../../packages/node/bin/brs.node.js");

const { sgRoot, SGNodeFactory, ComponentDefinition } = scenegraph;
const { Interpreter, Lexer, Parser, BrsString, BrsBoolean } = core;

const source = `
function onKeyEvent(key as string, press as boolean) as boolean
    if key = "OK" then
        return true
    end if
    if key = "up" then return press
    return key = "right"
end function
`;

/** onKeyEvent's result has to survive whichever way the handler returns. */
describe("Scene onKeyEvent return value", () => {
    let interpreter;
    let scene;

    beforeEach(() => {
        interpreter = new Interpreter();
        const { tokens } = new Lexer().scan(source, "pkg:/components/KeyScene.brs");
        const { statements } = new Parser().parse(tokens);

        scene = SGNodeFactory.createNode("Scene");
        const def = new ComponentDefinition("pkg:/components/KeyScene.xml");
        def.name = scene.nodeSubtype;
        def.environment = interpreter.environment.createSubEnvironment(false);
        interpreter.inSubEnv((sub) => {
            sub.exec(statements);
            return BrsBoolean.False;
        }, def.environment);
        sgRoot.setNodeDefMap(new Map([[scene.nodeSubtype.toLowerCase(), def]]));
        sgRoot.setScene(scene);
        sgRoot.setFocused();
    });

    afterEach(() => {
        sgRoot.setNodeDefMap(new Map());
    });

    const press = (key, down = true) => scene.handleOnKeyEvent(interpreter, new BrsString(key), BrsBoolean.from(down));

    test("return from inside an if block", () => {
        expect(press("OK")).toBe(true);
    });

    test("single-line if return passes the value through", () => {
        expect(press("up", true)).toBe(true);
        expect(press("up", false)).toBe(false);
    });

    test("top-level return", () => {
        expect(press("right")).toBe(true);
        expect(press("left")).toBe(false);
    });
});
