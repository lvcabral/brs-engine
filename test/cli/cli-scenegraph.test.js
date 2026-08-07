const path = require("path");
const { exec, brsCliPath } = require("./cli-test-utils");

// SceneGraph-specific CLI runtime behavior: node fields/aliases, observers, focus, Task threads,
// and layout/measurement. Each test spawns its own isolated `node brs.cli.js` child process and
// shares no in-process state, so they run concurrently (capped by `maxConcurrency` in
// vitest.config.mts). See cli.test.js for non-SceneGraph CLI behavior, cli-bpk.test.js for `.bpk`
// packaging/encryption, and cli-ecp.test.js for the ECP endpoints.
describe.concurrent("cli scenegraph", () => {
    it("SceneGraph App Test", async () => {
        let command = ["node", brsCliPath, "-r scenegraph", "source/Poster.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "Main -----------------------------------------------",
            "MAIN: poster node type:roSGNode",
            "MAIN: poster node subtype:Poster",
            "MAIN: poster node width: 0",
            "MAIN: poster node height: 0",
            "Main -----------------------------------------------",
            "INIT: BaseWidget",
            "EVENT: BaseWidget onUriChange in",
            "EVENT: =====",
            "EVENT:  3",
            "INIT: http://www.example.com/image.jpg",
            "INIT:  100",
            "INIT:  200",
            "INIT: http://www.example.com/base.jpg",
            "INIT: <Component: roAssociativeArray> =",
            "{",
            "    global: <Component: roSGNode:Node>",
            '    something: "in"',
            "    top: <Component: roSGNode:NormalWidget>",
            "}",
            "Change field test start",
            "add:0:0",
            "insert:0:0",
            "remove:1:1",
            "insert:0:0",
            "set:1:1",
            "remove:0:0",
            "remove:0:0",
            "add:0:0",
            "add:1:1",
            "add:2:2",
            "add:3:3",
            "remove:1:3",
            "remove:0:0",
            "add:0:0",
            "add:1:1",
            "add:2:2",
            "set:0:0",
            "set:1:1",
            "set:2:2",
            "Change field test complete",
            "MAIN:  200 100",
            "EVENT: BaseWidget onNormalStringFieldChange     <Component: roAssociativeArray> =",
            "{",
            "    global: <Component: roSGNode:Node>",
            "    node: <Component: roSGNode:Node>",
            '    something: "in"',
            "    top: <Component: roSGNode:NormalWidget>",
            "}",
            "EVENT: Hello World!",
            "EVENT: BaseWidget onUriChange in",
            "EVENT: =====",
            "EVENT:  3",
            "Main -----------------------------------------------",
            "MAIN: poster as child audioGuideText:fake text",
            "MAIN: poster as child uri:/fake/uri",
            "MAIN: poster as child loadWidth: 10.4",
            "------ Finished 'Poster.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("SceneGraph Node Alias Test", async () => {
        let command = ["node", brsCliPath, "-r multi-alias-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Multi-Field Alias ===",
            "Initial state:",
            "label1.text =",
            "label2.text =",
            "label3.text =",
            "",
            "After setting syncedValue to 'Hello, World!':",
            "label1.text = Hello, World!",
            "label2.text = Hello, World!",
            "label3.text = Hello, World!",
            "",
            "After updating label2 to 'Updated Value':",
            "scene.syncedValue = Updated Value",
            "label1.text = Updated Value",
            "label2.text = Updated Value",
            "label3.text = Updated Value",
            "",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("applies an interface field's default value through its alias targets", async () => {
        // Regression: addFields applied a field's XML default only on the non-alias branch, so an
        // aliased field with a default (e.g. `height` value="42" aliased to a child's height) never
        // wrote the default. The aliased child then read 0 — and a background Poster sized this way
        // would fall back to its bitmap's native size instead of the intended height.
        let command = ["node", brsCliPath, "-r alias-default-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Aliased Field Default ===",
            "scene.boxHeight = 42",
            "box1.height = 42",
            "box2.height = 42",
            "scene.boxWidth = 100",
            "box1.width = 100",
            "scene.trailing = present",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("findNode resolves ids breadth-first (shallow sibling wins over a child component's internals)", async () => {
        // Regression: findNodeById was depth-first, so it descended into an earlier sibling's
        // subtree — including a custom component's INTERNAL children — and returned a deep node
        // whose id shadowed a shallower sibling's (different case). Per Roku's ifSGNodeDict spec
        // the search is breadth-first: all nodes at one depth are tested before any deeper node.
        let command = ["node", brsCliPath, "-r find-node-bfs-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing findNode Breadth-First Order ===",
            "host findNode result = RowList:Label",
            "deep findNode result = innerLabel",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Keeps a component usable when interface field aliases have unresolvable targets", async () => {
        // Regression: a failed alias target (missing node or missing field) used to abort addFields,
        // dropping every <interface> field declared after it. A device only warns: the remaining
        // alias targets still bind and the trailing fields are still added.
        let command = ["node", brsCliPath, "-r bad-alias-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Failed Alias Targets ===",
            "scene.trailing = present",
            "label1.text = bound",
            "label2.text = synced",
            "label3.text = synced",
            "hasField allBad = false",
            "=== Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        // The device-style warnings are still written for each unresolvable target.
        expect(stderr).toContain("-- Interface field alias failed: No node named ghost");
        expect(stderr).toContain('-- Interface field alias failed: Node "label1" has no field named "nosuchfield"');
    }, 30000);

    it("SceneGraph Observers Test", async () => {
        let command = ["node", brsCliPath, "-r observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Testing Multi-Field Alias with Observers ===",
            "",
            "Setting scene.syncedValue to 'First Value'",
            "Label1 changed to: First Value",
            "Label2 changed to: First Value",
            "",
            "Setting label1.text to 'Second Value'",
            "Label1 changed to: Second Value",
            "Label2 changed to: Second Value",
            "",
            "=== Observer Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("ContentNode Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r contentnode-recursion-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ContentNode Recursion Repro ===",
            "Observer registrations: 1200",
            "Triggering ContentNode title update",
            "Callbacks fired: 1200",
            "=== ContentNode Recursion Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("ContentNode ParentField Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r contentnode-parentfield-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ContentNode ParentField Repro ===",
            "Trigger 1: listActive = true",
            "  Active: 1 ContentNotify: 1",
            "Trigger 2: listActive = false",
            "  Active: 3 ContentNotify: 2",
            "Trigger 3: listActive = true",
            "  Active: 6 ContentNotify: 3",
            "=== ContentNode ParentField Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Shared ContentNode Recursion Repro Test", async () => {
        let command = ["node", brsCliPath, "-r sharedcontent-recursion-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // One ContentNode shared by many fields must fan out to every observer exactly once
        // without overflowing the stack via nested parentField propagation (JellyRock #904).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Shared ContentNode Recursion Repro ===",
            "Shared content fields: 1500",
            "Triggering shared ContentNode update",
            "Callbacks fired: 1500",
            "=== Shared ContentNode Recursion Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Button Label Observer Order Test", async () => {
        let command = ["node", brsCliPath, "-r button-label-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A field observed inside one cascade must be able to notify more than once
        // (clear pass + fill pass); if the second notification is dropped the button's
        // inner Label is left blank.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Button Label Repro ===",
            "label.text = Save",
            "=== Button Label Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Binds an observer callback's parameters the way a device does", async () => {
        let command = ["node", brsCliPath, "-r observer-signature-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Device-measured on Roku OS 15.2 (see out/observer-signature-probe): an observer registered
        // by name gets the event ONLY when it declares exactly one parameter whose type accepts an
        // object; otherwise it is called with no arguments (every parameter taking its default),
        // which requires that no parameter is required; otherwise it is not called at all. No
        // coercion, and no partial binding. The `stringDefault`/`timerFire` rows are the shape that
        // regressed: binding the event to a `as string` parameter made a later `state = "stop"`
        // raise a Type Mismatch that cannot happen on a device.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Observer Signature Test ===",
            "noargs: no parameters",
            "untyped: p1=roSGNodeEvent",
            "object: p1=roSGNodeEvent field=trigger",
            "objectDefault: p1=roSGNodeEvent",
            "stringRequired: not called",
            "stringDefault: p1=String value=update isStop=false",
            "integerDefault: p1=Integer value=42",
            "twoParamsFirstRequired: not called",
            "twoParamsAllDefaulted: p1=String value=update p2=Invalid",
            "objectThenStringDefault: not called",
            "timerFire: p1=String value=update isStop=false",
            "=== Observer Signature Test Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Reentrant field observers are deferred until the current handler returns", async () => {
        let command = ["node", brsCliPath, "-r deferred-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // onSelected focuses two lists and moves focus via jumpToItem (firing their itemFocused
        // observers) BEFORE it assigns dayList.content. On Roku those observers run from the message
        // loop after the handler returns, so they see the assigned dayList.content. With
        // synchronous/inline dispatch they ran reentrantly while dayList.content was still invalid
        // -> crash. The deferred dispatch drains them after onSelected unwinds: "onSelected done"
        // prints before any "onDateFocused", and each reads the valid 31-child dayList content.
        // Each focused list fires itemFocused twice (on focus-gain, then on the jumpToItem move).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Deferred Observer Repro ===",
            "onSelected",
            "Setting dayList content",
            "onSelected done",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "onDateFocused dayCount= 31",
            "=== Deferred Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Fires itemFocused only when a list gains focus, not on content population while unfocused", async () => {
        let command = ["node", brsCliPath, "-r list-initial-focus-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The list is assigned an EMPTY content node, then that same node is populated afterwards
        // (as a content-loading Task does) - all while the list is NOT in the focus chain. Verified
        // on a real Roku: itemFocused only changes when focus moves onto an item, so populating an
        // unfocused list fires no observer and the field stays at its -1 "never focused" sentinel.
        // Only when the list is given focus does the first item gain focus and itemFocused fire
        // (index 0). This guards against re-emitting itemFocused on unfocused content load, which
        // makes list-driven side effects (e.g. a focused-item preview) trigger prematurely.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== List Initial Focus Repro ===",
            "itemFocused before populate = -1",
            "itemFocused after populate (unfocused) = -1",
            "focusing the list",
            "onItemFocused index =  0",
            "=== List Initial Focus Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Defers a focusedChild notification raised during init() so a later-registered observer fires", async () => {
        let command = ["node", brsCliPath, "-r init-focus-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // init() sets focus FIRST, then registers the focusedChild observers AFTER, in the same init.
        // Verified on a real Roku: focus notifications from setFocus() in init() dispatch from the
        // message loop after init returns, so the later-registered observers still fire (once each).
        // Before the fix the simulator dispatched focusedChild synchronously during setFocus() -
        // when no observer existed yet - so the notification was lost. The fix defers the init-time
        // focus notification and delivers it from the message loop after init: the observers
        // therefore fire AFTER "init done".
        //
        // Double-fire guard: onSceneFocus re-focuses `outer` inside its handler, which rewrites
        // `outer.focusedChild` inline. `outer` is still queued for delivery, so without the
        // consume-on-dispatch fix its observer would fire twice. onOuterFocus must appear once.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Init Focus Observer Repro ===",
            "before setFocus",
            "init done",
            "onSceneFocus fired",
            "onOuterFocus fired",
            "=== Init Focus Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("A reentrant observer that rewrites its own alwaysNotify field does not loop", async () => {
        let command = ["node", brsCliPath, "-r observer-loop-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // aliasField is alwaysNotify with an onChange (onAlias) that writes the same field back to
        // itself. A direct BrightScript assignment dispatches synchronously even inside another
        // observer (only engine-initiated emissions defer), so onAlias runs nested inside
        // onSelected and the per-field notifying guard suppresses the re-entrant self-write.
        // onAlias must fire exactly once.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Observer Loop Repro ===",
            "onSelected",
            "onAlias count= 1",
            "onSelected done",
            "=== Observer Loop Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Two cross-aliased alwaysNotify fields whose observers write each other do not loop", async () => {
        let command = ["node", brsCliPath, "-r cross-alias-loop-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // fieldF.onChange writes fieldG and fieldG.onChange writes fieldF (both alwaysNotify),
        // reassigned from inside an observer. Direct BrightScript assignments dispatch
        // synchronously/nested even when reentrant (only engine-initiated emissions defer), so the
        // per-field notifying guards (F held while G runs) terminate the cascade in one round.
        // Each observer fires exactly once (the manual field-alias ping-pong flood).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Cross Alias Loop Repro ===",
            "onStart",
            "onF count= 1",
            "onG count= 1",
            "onStart done",
            "=== Cross Alias Loop Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Dispatches a direct field assignment's observer synchronously inside another observer", async () => {
        let command = ["node", brsCliPath, "-r observer-readback-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A panel-creation observer builds a menu by assigning a detached item component's
        // itemContent and immediately reading back the calculatedWidth its observer computes
        // (the fit-to-content list-sizing pattern). The assignment is direct BrightScript, so
        // its observer must run synchronously even one observer level deep — deferring it makes
        // the read-back see 0 and the menu collapses to zero width.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Observer Readback Repro ===",
            "onBuild",
            "widest > 0: true",
            "onBuild done",
            "=== Observer Readback Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Poster preload-and-swap: the loadStatus observer's uri clear is not clobbered", async () => {
        let command = ["node", brsCliPath, "-r poster-preload-swap-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The preloader's loadStatus="ready" observer copies its uri onto the visible poster and then
        // clears its own uri (""). The Poster must commit the uri field BEFORE the synchronous load +
        // loadStatus notification so that clear sticks; otherwise a trailing re-commit reverts the
        // preloader's uri to the loaded image.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Poster Preload Swap Repro ===",
            "visiblePoster.uri = common:/images/icon_options.png",
            "preloadPoster.uri =",
            "=== Poster Preload Swap Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Allows redeclaring an inherited system field but still blocks XML duplicate fields", async () => {
        let command = ["node", brsCliPath, "-r duplicate-system-field-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout, stderr } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A field inherited from a built-in base type (a "system" field) may be redeclared in
        // XML: the redeclared default is re-applied (opacity -> 0.5) and any field declared after
        // it (customField) is still added. Before the fix the duplicate-field guard fired on the
        // inherited "opacity", aborting addFields so both were lost.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Duplicate System Field Repro ===",
            "opacity =  0.5",
            "customField = hello",
            "sharedField = base",
            "afterField type = Invalid",
            "=== Duplicate System Field Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
        // Redeclaring the inherited system field must NOT warn...
        expect(stderr).not.toContain('duplicate field "opacity"');
        // ...but redeclaring a field defined in an ancestor XML component still must.
        expect(stderr).toContain('Attempt to add duplicate field "sharedField" to RokuML component "XmlChildComp"');
    }, 30000);

    it("Restores the m context on a rebuilt custom component so callFunc sees m.top/m.global", async () => {
        let command = ["node", brsCliPath, "-r clone-callfunc-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A custom component subclassing a data node is rebuilt through createFlatNode (the same
        // path a cross-thread Task copy takes; clone() exercises it single-threaded). Before the fix
        // the rebuilt node had an empty `m`, so invoking a public function via callFunc ran with an
        // invalid `m.top` and crashed. Both fields must now resolve.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Clone CallFunc Repro ===",
            "clone subtype = MyData",
            "readTop = MyData",
            "readGlobal = VALID_GLOBAL",
            "=== Clone CallFunc Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Boxes a computed string argument crossing callFunc the same way a node field get/set already does", async () => {
        let command = ["node", brsCliPath, "-r callfunc-string-boxing-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A computed string pushed into an array reports type() as "String" until it crosses a node
        // boundary. Node.get()/Field.convertValue already box field reads/writes this way, but
        // callFunc passed its arguments through untouched - device-verified divergence (a real Roku
        // always boxes callFunc arguments, same-thread included).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== CallFunc String Boxing Repro ===",
            "callfunc-plain = roString|roString",
            "tr-hit-callfunc = roString|roString",
            "tr-miss-callfunc = roString|roString",
            "tr-miss-raw = String|String",
            "=== CallFunc String Boxing Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Reparents a node when it is attached to a different parent", async () => {
        let command = ["node", brsCliPath, "-r reparent-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // On Roku a node has exactly one parent: appendChild/insertChild/replaceChild detach the
        // node from its previous parent. Before the fix the old parent kept the node in its
        // children array, so the render traversal drew the subtree twice — once inside the new
        // (translated) container and once at the node's raw position under the old parent.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Reparent Repro ===",
            "root child count =  1",
            "inner child count =  1",
            "moved parent is inner = true",
            "a child count =  0",
            "b child count =  1",
            "c parent is b = true",
            "b child count after insert =  0",
            "c parent is d = true",
            "d child count after replace =  0",
            "c parent is e = true",
            "=== Reparent Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Loads Library statements declared in component scripts into the component scope", async () => {
        let command = ["node", brsCliPath, "-r component-library-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A `Library` statement in a component <script> must load the library's functions
        // into that component's scope (Roku_Ads is required by the manifest), while the
        // manifest gate still keeps out declared-but-not-required libraries (IMA3).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Component Library Repro ===",
            "rafType = roAssociativeArray",
            "adUrl = http://ads.example.com/preroll",
            "podCount =  1",
            "libVersion = 3.5",
            "imaLoaded = not loaded",
            "=== Component Library Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Guards bounding-rect refresh renders against re-entrant measurement", async () => {
        let command = ["node", brsCliPath, "-r grid-measure-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A bounding-rect query outside a frame render refreshes layout by rendering the whole
        // tree, lazily creating grid item components. An item's field observer calling
        // boundingRect() inside that refresh must reuse the active pass (sgRoot.rendering guard)
        // instead of starting another refresh — item creation would re-enter itself and overflow
        // the JS call stack ('roSGNode.Set: Maximum call stack size exceeded').
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Grid Measure Repro ===",
            "onHeightChange measured height =  72",
            "onHeightChange measured height =  72",
            "onHeightChange measured height =  72",
            "grid rect height =  240",
            "=== Grid Measure Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Sets an attached Panel's height from the PanelSet, firing observers registered in init()", async () => {
        let command = ["node", brsCliPath, "-r panel-height-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Per the Roku spec, Panel.height defaults to -1 and "will be set by the PanelSet";
        // apps observe their panel's height in init() (before appendChild) to size
        // panel-local UI. The attach-time write must be a notifying setValue, and a later
        // PanelSet height change must propagate to attached panels.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Panel Height Repro ===",
            "init height = -1",
            "detached height = -1",
            "observed height =  1080",
            "attached height =  1080",
            "observed height =  720",
            "resized height =  720",
            "=== Panel Height Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Reports a RowList's newly focused item at the settled focus band, not its pre-scroll position", async () => {
        let command = ["node", brsCliPath, "-r rowlist-subrect-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A RowList lays out its focused row at the fixed focus band (renderNode sets currRow =
        // focusIndex). After a vertical focus change, an app's rowItemFocused observer measures the
        // newly focused item synchronously via subBoundingRect BEFORE the next frame re-lays-out the
        // grid, so the cached item rect is stale (the item still sits at its previous, pre-scroll
        // stacked position). subBoundingRect must refresh layout when a focus change is pending so it
        // reports the settled band position — matching a real device where the observer fires
        // post-layout. Without the refresh, row 1 reads its stacked y (band + one row height).
        //
        // The reported y is the item component's own position — the grid's translation, here 120.
        // An item sub-rect carries NO outset: not the grid's own reported outset (RowList marginY,
        // applied by ArrayGrid.updateRect and cancelled in Node.getSubBoundingRect because base and
        // rectToScene both carry it), and not the drawn focus 9-patch frame. Both printed booleans
        // derive from the fixture's declared translation/rowItemSize, so nothing here can drift.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== RowList SubRect Repro ===",
            "band row0 y =  120",
            "focused row1 y =  120",
            "SAME BAND: true",
            "ON POSTER: true",
            "SIZE IS POSTER: true",
            "=== RowList SubRect Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);
    it("Measures a freshly-created grid item's content during the render pass that creates it", async () => {
        let command = ["node", brsCliPath, "-r button-measure-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Repro of a fit-to-content button's pill background collapsing to a circle. An ArrayGrid
        // lazily creates each item component and assigns its itemContent DURING the grid's render
        // pass. The item's itemContent observer sets its label text and then sizes a background from
        // elementsGroup.boundingRect().width (as EnhancedButton.renderButton does). That measurement
        // runs while sgRoot.rendering is true, on a content subtree the pass has not laid out yet.
        // getBoundingRect must render just that unmeasured subtree (not skip and return a stale 0),
        // so the content width is real and the background is not collapsed. Before the fix every
        // measurement read 0 (in the app: a 9-patch pill drawn at its corner sum — a circle).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Button Measure Repro ===",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "content measured > 0 = true",
            "background wider than padding = true",
            "grid rect height =  156",
            "=== Button Measure Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);
    it("Builds the layout-pass performance probe (70 self-measuring components)", async () => {
        let command = ["node", brsCliPath, "-r layout-perf-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // Committed form of the synthetic probe from docs/scenegraph-layout-passes.md: 70 custom
        // components in a LayoutGroup, each measuring itself with boundingRect() from its `value`
        // observer, so every append triggers a full-tree layout refresh. Only correctness is
        // asserted (the layout height proves all 70 tiles laid out and stacked); the per-tile
        // timings it prints are for the human device-shape comparison — flat per-component cost —
        // and would be flaky as assertions. Height: 70 tiles * 60 + 69 gaps * 8 = 4752.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Layout Perf Probe ===");
        expect(lines).toContain("tiles =  70");
        // 70 tiles, each 60 (background) + label rows overflow = stacked LayoutGroup height;
        // proves all 70 laid out. Kept exact so tile-content changes are deliberate.
        expect(lines).toContain("layout height =  15532");
        expect(lines).toContain("=== Layout Perf Probe Complete ===");
        for (const marker of ["q1 tile ms = ", "q2 tile ms = ", "q3 tile ms = ", "q4 tile ms = ", "total ms = "]) {
            expect(lines.some((line) => line.startsWith(marker))).toBe(true);
        }
    }, 60000);
    it("Pruned layout refreshes agree with unpruned refreshes (BRS_PRUNE_DISABLE)", async () => {
        // The pruned refresh (default) and a fully unpruned run must produce identical program
        // output across refresh-heavy workloads: 70 self-measuring components whose observers
        // print measured heights, and re-entrant grid item creation printing measured rects. Any
        // rect a pruned pass got wrong would change these printed values.
        for (const app of ["layout-perf-app", "grid-measure-app"]) {
            let command = ["node", brsCliPath, `-r ${app}`, "source/main.brs", "-c 0"].join(" ");
            const pruned = await exec(command, { cwd: path.join(__dirname, "resources") });
            const unpruned = await exec(command, {
                cwd: path.join(__dirname, "resources"),
                env: { ...process.env, BRS_PRUNE_DISABLE: "1" },
            });
            const strip = (stdout) =>
                stdout
                    .split("\n")
                    .map((line) => line.trimEnd())
                    .filter((line) => !/^(q\d tile|total) ms = /.test(line)); // timings vary
            expect(strip(pruned.stdout)).toEqual(strip(unpruned.stdout));
        }
    }, 120000);
    it("Resolves a component method in call position when an XML field shadows its name", async () => {
        let command = ["node", brsCliPath, "-r method-shadow-field-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });

        // A component may declare an <interface> field named after a built-in method
        // (e.g. isInFocusChain). On Roku the field only shadows the method for reads:
        // call syntax still resolves the interface method, while plain reads and
        // observeField target the XML field (a custom progress-bar component relies on this).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Method Shadow Field Repro ===",
            "init call isInFocusChain() = false",
            "observer fired with true",
            "field read = true",
            "method call = false",
            "=== Method Shadow Field Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Runs a SceneGraph Task on a worker thread with cross-thread rendezvous", async () => {
        let command = ["node", brsCliPath, "-r task-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The Task's functionName runs on a dedicated worker thread: reading `input` and
        // writing `result` both rendezvous with the render thread, and the observer fires
        // back on the render thread. Debug lines from the task machinery may interleave,
        // so assert the key lines instead of the exact output.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Thread Repro ===");
        expect(lines).toContain("TASK RESULT: from-task-thread:ping");
        expect(lines).toContain("=== Task Thread Repro Complete ===");
        expect(lines).toContain("------ Finished 'main.brs' execution [EXIT_USER_NAV] ------");
    }, 30000);

    // Retried and pulled out of the file's concurrent scheduling for the same reason as the
    // Timer-hop test below: this exercises real OS-thread scheduling across 3 Task threads plus
    // the render thread, so it competes for CPU with sibling `node brs.cli.js` child processes
    // when run concurrently. Under a loaded CI runner the chain can occasionally miss its
    // (generous) timing budget even though every hop completed correctly - see the widened
    // budgets in task-pool-app's Main.brs/DispatchTask.xml. A genuine regression in the
    // cross-thread delivery this guards (see the mechanism notes below) fails deterministically,
    // so retrying stays safe.
    it.sequential(
        "Delivers a field set from one Task thread to another Task's thread",
        { retry: 2 },
        async () => {
            let command = ["node", brsCliPath, "-r task-pool-app", "source/main.brs", "-c 0"].join(" ");

            let { stdout } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            // Worker-pool apps park a long-lived Task on a port and dispatch to it from other Task
            // threads. That write was silently dropped: `Task.setValue` synced through the *target*
            // Task as transport, but a foreign Task node is only a deserialized copy with no thread
            // of its own (`threadId < 0`), so `syncRemoteField` returned early and nothing crossed.
            // The coordinator's notification broke separately: `observeField(field, port)` from a task
            // thread rendezvouses to the render thread, where the port is rebuilt as a fresh empty
            // RoMessagePort, so the render side held a dead observer and the task's real port never
            // fired. `task`-domain fan-out was also skipped wholesale, which is what "WATCHER SAW"
            // guards — a coordinator watching a pool slot it does not own.
            const lines = stdout.split("\n").map((line) => line.trimEnd());
            expect(lines).toContain("=== Task Pool Repro ===");
            expect(lines).toContain("SLOT READY");
            expect(lines).toContain("WATCHER READY");
            expect(lines).toContain("DISPATCH: sent");
            expect(lines).toContain("SLOT RESPONSE: echo:ping");
            expect(lines).toContain("WATCHER SAW: echo:ping");
            // The blocking-request pattern: the caller builds a node, port-observes it while it is
            // still task-owned (so that observeField never rendezvouses), then hands it over. The
            // render thread only learns a port is waiting from the `_observed_` data carried across.
            expect(lines).toContain("DISPATCH GOT: echo:ping");
            expect(lines).toContain("DISPATCHER REPLY: echo:ping");
            // One dispatch must raise exactly one event. The owner answers a rendezvous *read* with an
            // update whose action is `set`, and applying it with notification made reading a field
            // indistinguishable from changing it: the slot's own `req = m.top.request` re-fired its port,
            // and an assocarray field always compares unequal so it never settled. A continuous-server
            // loop then re-ran the same work indefinitely, and a coordinator keying completions off such
            // a port credited responses to the wrong caller.
            expect(lines).toContain("SLOT EVENT #1");
            expect(lines).not.toContain("SLOT EVENT #2");
            expect(lines).not.toContain("WATCHER PHANTOM EVENT");
            expect(lines).toContain("=== Task Pool Repro Complete ===");
            expect(lines).toContain("------ Finished 'main.brs' execution [EXIT_USER_NAV] ------");
        },
        40000
    );

    it("Delivers a field change to a port a Task registered during init()", async () => {
        let command = ["node", brsCliPath, "-r task-globalobserve-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // The documented Task pattern (docs/limitations.md): the task registers a port observer in
        // init() — which runs on the render thread, so it never goes through the rendezvous
        // observeField path — and consumes events from its own thread. The only record that the task
        // is waiting is the `hostNode` on the observer callback, so cross-thread fan-out has to
        // attribute observers by it. Picking fan-out targets any other way either misses this task or
        // (if it answers "observed" for every scope) broadcasts each update to all of them.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Global Observe Repro ===");
        expect(lines).toContain("TASK READY");
        expect(lines).toContain("OBSERVER GOT: hello");
        expect(lines).toContain("SCENE SAW: hello");
        expect(lines).not.toContain("OBSERVER: timed out");
        expect(lines).toContain("=== Task Global Observe Repro Complete ===");
    }, 30000);

    it("Delivers a field set between control=run and task launch exactly once", async () => {
        let command = ["node", brsCliPath, "-r task-prelaunch-events-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // `control = "run"` activates the task synchronously (turning render->task fan-out on), but
        // the payload that carries the pre-launch port backlog is only posted on the next
        // processTasks pass. A write landing in between used to be captured by both paths and
        // arrive twice. Both sides of that boundary are asserted here: writes issued *before*
        // control=run must still arrive (they have no other carrier), and writes issued after it
        // must arrive exactly once — including one on m.global, which reaches the task by a
        // different fan-out route than the task node's own fields.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Pre-launch Events Repro ===");
        expect(lines).toContain(
            "TASK SAW: request=before-1,request=before-2,request=after-1,request=after-2,ticket=global-1"
        );
        expect(lines).toContain("SCENE REPORT: 5 events");
        expect(lines).toContain("=== Task Pre-launch Events Repro Complete ===");
    }, 30000);

    it("Terminates the app when a Task thread hits an uncaught error", async () => {
        let command = ["node", brsCliPath, "-r task-crash-app", "source/main.brs", "-c 0"].join(" ");

        // The crash makes the CLI exit non-zero, so the output comes off the rejection.
        let stdout = "";
        let stderr = "";
        try {
            ({ stdout, stderr } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            }));
        } catch (err) {
            stdout = err.stdout ?? "";
            stderr = err.stderr ?? "";
        }
        // An uncaught error in a Task thread terminates the app on a device (device-verified), which
        // is also what the engine does for the app thread and what the browser API already did for a
        // task worker — a task's `end,` reaches the same handler as the app worker's. The Node host
        // relayed it as plain output instead, so the app carried on running with a dead task thread.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task Crash Repro ===");
        expect(lines).toContain("STATE: run");
        expect(lines).toContain("TASK CRASHING");
        expect(lines).not.toContain("TASK NOT REACHED");
        expect(stdout + stderr).toContain("'Dot' Operator attempted with invalid BrightScript Component");
        // The app is gone: its own completion print (after the render thread's wait loop) is never
        // reached, and the run ends on the crash reason rather than a normal exit.
        expect(lines).not.toContain("=== Task Crash Repro Complete ===");
        expect(stdout).toContain("[EXIT_BRIGHTSCRIPT_CRASH]");
    }, 30000);

    it("roDataGramSocket performs real UDP send/receive from inside a Task", async () => {
        let command = ["node", brsCliPath, "-r udp-loopback-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Exercises the full SetAddress/SetBroadcast-adjacent bind, SendStr, NotifyReadable, Wait,
        // roSocketEvent, ReceiveStr loop end-to-end through the real interpreter running inside a Task
        // worker thread — matching how real apps (e.g. Jellyfin's server-discovery Task) use
        // roDataGramSocket. The task never calls Close() on its sockets, so this also proves the
        // DatagramBridge helper process cleanup (stdin-close safety net) survives Task worker
        // termination without hanging the CLI process.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== UDP Loopback Repro ===");
        // `print` inserts a leading space before a numeric value's own text (Roku's `;`-separator
        // semantics), so a bound port reads "port= 12345" and the byte count "sent= 14".
        expect(lines.some((line) => /^TASK: bound=true port= \d+$/.test(line))).toBe(true);
        expect(lines).toContain("TASK: sent= 14");
        expect(lines).toContain("TASK: result=ping from task");
        expect(lines).toContain("CONTENT: ping from task");
        expect(lines).toContain("=== UDP Loopback Repro Complete ===");
    }, 30000);

    it("Notifies a Task's port when it mutates a ContentNode held by an observed field", async () => {
        let command = ["node", brsCliPath, "-r task-contentcache-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // A ContentNode assigned to a node-typed field notifies that field's observers when its own
        // content changes (`ContentNode.notifyParentFields`) — but that path starts from the field,
        // not from the node holding it, so it skipped the cross-thread fan-out `Node.setValue` does.
        // A task mutating such a ContentNode (a rendezvous call, applied on the render thread) then
        // never heard back about its own change and waited forever.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("=== Task ContentCache Repro ===");
        expect(lines).toContain("TASK SAW CACHE CHANGE 1");
        expect(lines).toContain("TASK SAW CACHE CHANGE 2");
        expect(lines).toContain("TASK SAW CACHE CHANGE 3");
        expect(lines).toContain("SCENE SAW ROWS:  3");
        expect(lines).toContain("=== Task ContentCache Repro Complete ===");
    }, 30000);

    it("Clears a node-valued field set to invalid from a Task thread", async () => {
        let command = ["node", brsCliPath, "-r task-clear-node-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Setting a node-valued field to `invalid` from a task sends an update whose value is null.
        // The render side read `_address_` off it to decide whether to reconcile against the node it
        // already held, which threw and aborted the whole task-update pass — the task's later writes
        // never landed and the app hung waiting for them.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("PAYLOAD: Payload");
        expect(lines).toContain("PAYLOAD: invalid");
        expect(lines).toContain("FINISHED: task completed");
        expect(lines).toContain("=== Task Clear Node Repro Complete ===");
    }, 30000);

    it("Keeps script-scope references to global/top alive across a Task launch", async () => {
        let command = ["node", brsCliPath, "-r task-script-scope-ref-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // `m.global` and `m.top` are serialized before the rest of `m`, so any other entry holding
        // the same nodes (a cache, or a transpiled class instance that stored `GetGlobalAA().global`
        // in a field) crosses as a `_circular_` back-reference. The task-side restore rebuilt `m`'s
        // other entries *first*, so those references had nothing to resolve against: they came back
        // `invalid` and the first dot access on one crashed the task thread.
        const lines = stdout.split("\n").map((line) => line.trimEnd());
        expect(lines).toContain("HELPER GLOBAL TYPE: roSGNode");
        expect(lines).toContain("HELPER TOP TYPE: roSGNode");
        expect(lines).toContain("HELPER GLOBAL VERSION: 10.9.0");
        expect(lines).toContain("HELPER TOP LABEL: grid");
        // The same shape one level deeper — references to nodes *inside* the `m.top` subtree.
        // Both must resolve to the one real node, not to a detached copy.
        expect(lines).toContain("FIELD REF TYPE: roSGNode");
        expect(lines).toContain("FIELD REF TITLE: payload-from-init");
        expect(lines).toContain("FIELD REF SAME: true");
        expect(lines).toContain("CHILD REF TYPE: roSGNode");
        expect(lines).toContain("CHILD REF TITLE: child-from-init");
        expect(lines).toContain("CHILD REF SAME: true");
        expect(lines).toContain("TASK RESULT: ok");
        expect(lines).toContain("RENDER SEES TITLE: changed-in-task");
        expect(lines).toContain("=== Task Script Scope Ref Repro Complete ===");
    }, 30000);

    it("Resolves an anonymous function observer registered by its toStr() name", async () => {
        let command = ["node", brsCliPath, "-r anon-observer-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // rokucommunity/promises (used by Rooibos node tests) registers a callback by identifying an
        // anonymous function via the name reported by toStr(), then passing that name to observeField.
        // brs-engine names anonymous functions "$anon_..." but did not make them resolvable by that
        // name, so observeField silently failed and the Timer's "fire" observer never ran (every
        // @SGNode Rooibos suite hung). The anonymous-callable registry makes the name resolve again.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Anon Observer Repro ===",
            "observe ok=true",
            "OBSERVER FIRED",
            "=== Anon Observer Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    // This asserts a ~20ms wall-clock budget around a 125ms Timer chain, so it is opted out of the
    // suite's concurrency (not measured while sibling CLI child processes run) and retried: under a
    // fully loaded machine, scheduler noise alone can push a healthy run past the bound. Retrying is
    // safe because the regression it guards is systematic - the frame-throttle coupling made *every*
    // run ~160ms+ - so a genuine regression still fails all attempts.
    it.sequential(
        "Resolves a chain of near-zero-duration Timer nodes without frame-period latency per hop",
        { retry: 2 },
        async () => {
            let command = ["node", brsCliPath, "-r timer-hop-app", "source/main.brs", "-c 0"].join(" ");

            let { stdout } = await exec(command, {
                cwd: path.join(__dirname, "resources"),
            });
            // Rooibos-promises resolves promises via a chain of "essentially next tick" SGNode Timers
            // (duration ~0). Timer polling used to be coupled to the screen's frame-rate-limiting busy
            // wait, so each hop in the chain could cost up to a full frame period even though its nominal
            // duration was ~0 - a 125ms Timer plus two such hops measured ~160ms+ instead of ~125ms (this
            // is what made a Rooibos test that passes on a real device fail in brs-desktop/brs-cli). With
            // polling decoupled from the frame throttle, the whole chain resolves within a few ms of the
            // Timer's own duration.
            const match = stdout.match(/total elapsed=\s*(\d+)/);
            expect(match).not.toBeNull();
            const elapsedMs = Number(match[1]);
            expect(elapsedMs).toBeGreaterThanOrEqual(125);
            expect(elapsedMs).toBeLessThan(145);
        },
        30000
    );

    it("List item component can read its parent list during init()", async () => {
        let command = ["node", brsCliPath, "-r list-item-parent-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of the JellyRock JRServer item: a custom list item sizes its focus border from
        // m.top.getParent().itemSize in init(). The item must already be attached to its list when
        // init() runs (as on a real device), so getParent() resolves the list and itemSize is read.
        // Before the fix the parent was attached after init(), so getParent() was invalid and the
        // border stayed 0x0 (rendered tiny in the corner).
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== List Item Parent Repro ===",
            "ServerItem init: focusBorder = 1520x 100",
            "=== List Item Parent Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("StandardDialog forwards focus to a custom component's nested button group", async () => {
        let command = ["node", brsCliPath, "-r dialog-buttongroup-focus-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of the pplus-proxy ThemeDialog: a custom dialog on the StandardDialog framework whose
        // interactive widget is a plain LayoutGroup-based button group (no StdDlgButtonArea). It drives
        // focus via its own focusedChild observer + hasFocus(), with the dialog focused from inside a
        // field-observer callback. setNodeFocus must make the dialog itself the focused node so that
        // observer fires and forwards focus into the button group (otherwise no button is highlighted),
        // and must re-deliver focus when the dialog is explicitly re-focused after focus moved away.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Dialog ButtonGroup Focus Repro ===",
            "  ExButtons received focus -> highlight first button",
            "after show: isInFocusChain = true",
            "  ExButtons received focus -> highlight first button",
            "after refocus: isInFocusChain = true",
            "=== Dialog ButtonGroup Focus Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("Ignores a focus re-grab raised from a focus-loss observer, but honors a forward one", async () => {
        let command = ["node", brsCliPath, "-r focus-steal-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of the sgRouter/JellyRock shape, pinned against a Roku Express 4K+ (OS 15.3) capture
        // from the focus-probe apps. Two invariants, both device-measured:
        //   1. A focusedChild observer reads the COMMITTED chain - the whole focus transaction lands
        //      before any notification goes out ("outlet lost focus" already sees sceneFC = overhang).
        //   2. A setFocus raised from a focus-LOSS notification is dropped, so the chain and the
        //      remote stay with the node the in-flight transaction focused; the mirror-image FORWARD
        //      case (a container handing focus onward after gaining it) is still honored.
        // Before the fix the re-grab won live focus while the outer transaction wrote its own chain,
        // so sgRoot.focused and focusedChild disagreed: the app kept the remote on the grid while the
        // chain said "menu".
        // Two further guards on the mechanism itself: the drop applies only while a node is TAKING
        // focus (an unfocus observer's restore has no competing target, and swallowing it would
        // leave nothing focused at all), and staging the chain must still run the subclass setValue
        // overrides - a Button that bypasses Group.setValue never marks itself dirty, so its focused
        // font is never applied and the button stays at its unfocused width.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== Focus Steal Repro ===",
            "  outlet lost focus: sceneFC = overhang, overhangFC = menuA",
            "after steal: menuA = true, gridA = false",
            "after steal: sceneFC = overhang, outletFC = invalid, overhangFC = menuA",
            "  outlet lost focus: sceneFC = overhang, overhangFC = menuA",
            "after forward: menuB = true, overhangFC = menuB",
            "after recover: gridB = true, pageFC = gridB, sceneFC = outlet",
            "  outlet lost focus: sceneFC = invalid, overhangFC = invalid",
            "after unfocus restore: gridB = true, sceneFC = outlet",
            "button width before:  179",
            "  outlet lost focus: sceneFC = btn, overhangFC = invalid",
            "button width after:  250",
            "=== Focus Steal Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("ButtonGroup leaves custom (non-Button) children unmanaged", async () => {
        let command = ["node", brsCliPath, "-r buttongroup-custom-children-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a keyboard screen whose bottom row is a built-in ButtonGroup used purely as a
        // horizontal layout container for custom Group-based button components, with the screen
        // moving focus between them via setFocus(). The group must not manage such children: it
        // used to capture them into `buttons`, re-stack them vertically at x=0 (drawing the right
        // button over the left), steal focus back to index 0 on every render, and consume OK —
        // firing buttonSelected for the wrong (hidden) button.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== ButtonGroup Custom Children Repro ===",
            "left x =  0",
            "right x =  216",
            "left text = Left",
            "right text = Right",
            "right hasFocus = true",
            "left hasFocus = true",
            "right x after focus =  216",
            "children count =  2",
            "=== ButtonGroup Custom Children Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("PanelSet creates the right panel on item focus without hasNextPanel", async () => {
        let command = ["node", brsCliPath, "-r panelset-nextpanel-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a sliding-panels settings screen showing only its left menu. The right detail
        // panel is created via the createNextPanelOnItemFocus mechanism: focusing a grid item sets
        // createNextPanelIndex, and the app responds by setting nextPanel. That whole chain must be
        // driven by createNextPanelOnItemFocus, NOT gated on hasNextPanel (which only governs the
        // right-arrow indicator / forward navigation to a further panel). Before the fix the menu
        // panel's hasNextPanel was false, so the nextPanel callback was never wired: no second panel
        // was appended and numPanels stayed 1.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== PanelSet NextPanel Repro ===",
            "before focus numPanels =  1",
            "created right panel for index  0",
            "after focus numPanels =  2",
            "=== PanelSet NextPanel Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);

    it("PanelSet clears the trailing detail panel when the app supplies no next panel", async () => {
        let command = ["node", brsCliPath, "-r panelset-clearpanel-app", "source/main.brs", "-c 0"].join(" ");

        let { stdout } = await exec(command, {
            cwd: path.join(__dirname, "resources"),
        });
        // Repro of a sliding-panels settings menu. The left ListPanel uses the
        // createNextPanelOnItemFocus mechanism: focusing a menu item sets createNextPanelIndex and the
        // app responds by assigning a detail Panel to nextPanel. Item 0 supplies a focusable detail
        // panel (numPanels 1 -> 2); item 1 supplies an informational About panel that replaces it
        // (numPanels stays 2); item 2 ("Exit") supplies NO panel — the engine must then clear the
        // trailing detail panel so only the menu remains (numPanels drops back to 1). Before the fix
        // the stale previous detail panel was kept, matching neither Roku nor the app's intent.
        // Returning to item 0 re-creates its detail panel (1 -> 2). Re-focusing the SAME item (as the
        // PanelSet does when focus returns from the left) re-fires createNextPanelIndex for that index;
        // the app re-supplies the same panel and it must NOT be cleared (numPanels stays 2) — the clear
        // only runs on a genuine move to a new item whose app supplies nothing.
        expect(stdout.split("\n").map((line) => line.trimEnd())).toEqual([
            "=== PanelSet ClearPanel Repro ===",
            "item 0 numPanels =  2",
            "item 1 numPanels =  2",
            "item 2 numPanels =  1",
            "back to 0 numPanels =  2",
            "re-focus 0 numPanels =  2",
            "=== PanelSet ClearPanel Repro Complete ===",
            "------ Finished 'main.brs' execution [EXIT_USER_NAV] ------",
            "",
            "",
        ]);
    }, 30000);
});
