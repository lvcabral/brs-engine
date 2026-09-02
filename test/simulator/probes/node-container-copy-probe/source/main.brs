' ============================================================================================
' Node Copy & Identity Probe
'
' Answers two questions that a first device run left ambiguous:
'
'   Q-A  What does roUtils.IsSameObject actually compare for an roSGNode? A device reported `false`
'        for a node read back out of an assocarray field even though the node still behaved like the
'        original. If a *plain* node-field read / findNode / getChild also reports `false` (section
'        S2), then IsSameObject mints a handle per retrieval and container copying is irrelevant to
'        it. If only the container paths report `false`, the container really does duplicate.
'
'   Q-B  Does a container copy (assocarray/array field read, roUtils.DeepCopy) duplicate the node, or
'        carry the reference? Decided by whether a write through the copy is visible through the
'        original (S4.6/S4.7, S5.5/S5.6, S6.7/S6.8, S7.6/S7.7) -- behaviour, not identity reporting.
'
' Every section builds a FRESH agent so the mutation tests cannot leak into later sections.
' ============================================================================================
sub Main()
    print "=== Node Copy & Identity Probe ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    di = CreateObject("roDeviceInfo")
    print "[env] model=" + di.GetModel() + " os=" + di.GetOSVersion().major + "." + di.GetOSVersion().minor

    utils = CreateObject("roUtils")
    if utils = invalid
        print "[env] FATAL roUtils unavailable (needs Roku OS 15.0+) -- cannot run this probe"
        return
    end if

    runS1(utils)
    runS2(utils, scene)
    runS3(scene)
    runS4(utils, scene)
    runS5(utils, scene)
    runS6(utils)
    runS7(utils)
    runS8(utils)
    runS9(utils, scene)
    runS10(utils)
    runS11(utils, scene)
    runS12(scene)

    print "=== Node Copy & Identity Probe Complete ==="
end sub

' --------------------------------------------------------------------------------------------
' S1 -- IsSameObject baselines with NO copy anywhere. Establishes what the function compares.
' --------------------------------------------------------------------------------------------
sub runS1(utils as Object)
    print "--- S1: IsSameObject baselines (no copy involved) ---"
    agent = newAgent("s1-token")

    say("S1.1  node: same variable twice     ", utils.IsSameObject(agent, agent))
    alias = agent
    say("S1.2  node: aliased variable        ", utils.IsSameObject(alias, agent))
    say("S1.3  node: passed as function arg  ", sameAsArg(utils, agent, agent))

    plain = { a: agent, b: agent }
    say("S1.4  node: plain AA entry twice    ", utils.IsSameObject(plain.a, plain.a))
    say("S1.5  node: plain AA two entries    ", utils.IsSameObject(plain.a, plain.b))
    arr = [agent, agent]
    say("S1.6  node: plain array elem twice  ", utils.IsSameObject(arr[0], arr[0]))
    say("S1.7  node: plain array two elems   ", utils.IsSameObject(arr[0], arr[1]))

    sharedAA = { k: 1 }
    docCase = { a: sharedAA, b: sharedAA }
    say("S1.8  AA:   plain AA two entries    ", utils.IsSameObject(docCase.a, docCase.b))
    print "        ^ ifUtils docs state this is true"

    dt = CreateObject("roDateTime")
    dtAA = { a: dt, b: dt }
    say("S1.9  roDateTime: same variable     ", utils.IsSameObject(dt, dt))
    say("S1.10 roDateTime: plain AA entries  ", utils.IsSameObject(dtAA.a, dtAA.b))
end sub

function sameAsArg(utils as Object, passed as Object, original as Object) as Boolean
    return utils.IsSameObject(passed, original)
end function

' --------------------------------------------------------------------------------------------
' S2 -- DECISIVE for Q-A. Node retrievals that involve NO container copy at all. If these are
'       `false`, IsSameObject mints a handle per retrieval and says nothing about duplication.
' --------------------------------------------------------------------------------------------
sub runS2(utils as Object, scene as Object)
    print "--- S2: IsSameObject on plain node retrievals (NO container copy) ---"
    agent = newAgent("s2-token")
    agent.id = "S2Agent"
    scene.appendChild(agent)
    scene.agentNode = agent

    say("S2.1  node FIELD read vs original   ", utils.IsSameObject(scene.agentNode, agent))
    say("S2.2  node FIELD read twice         ", utils.IsSameObject(scene.agentNode, scene.agentNode))
    say("S2.3  getField(node) vs original    ", utils.IsSameObject(scene.getField("agentNode"), agent))
    say("S2.4  findNode twice                ", utils.IsSameObject(scene.findNode("S2Agent"), scene.findNode("S2Agent")))
    say("S2.5  findNode vs original          ", utils.IsSameObject(scene.findNode("S2Agent"), agent))
    kid = scene.getChildCount() - 1
    say("S2.6  getChild twice                ", utils.IsSameObject(scene.getChild(kid), scene.getChild(kid)))
    say("S2.7  getChild vs original          ", utils.IsSameObject(scene.getChild(kid), agent))
    say("S2.8  getParent twice               ", utils.IsSameObject(agent.getParent(), agent.getParent()))
    say("S2.9  getParent vs scene            ", utils.IsSameObject(agent.getParent(), scene))
    say("S2.10 isSameNode: field read        ", scene.agentNode.isSameNode(agent))

    scene.removeChild(agent)
end sub

' --------------------------------------------------------------------------------------------
' S3 -- Is the CONTAINER itself copied on set and on read? (no nodes involved)
' --------------------------------------------------------------------------------------------
sub runS3(scene as Object)
    print "--- S3: assocarray field container copy semantics (no nodes) ---"
    src = { k: "orig", nested: { n: "orig-n" } }
    scene.services = src

    src.k = "mutated-source"
    say("S3.1  mutate SOURCE after set       ", scene.services.k)
    print "        ^ 'orig' => the SET copied; 'mutated-source' => stored by reference"

    r1 = scene.services
    r1.k = "mutated-readback"
    say("S3.2  mutate READ-BACK, re-read     ", scene.services.k)
    print "        ^ 'orig' => the READ copied; 'mutated-readback' => read is by reference"

    r2 = scene.services
    r2.nested.n = "mutated-nested"
    say("S3.3  mutate nested AA, re-read     ", scene.services.nested.n)
    print "        ^ 'orig-n' => the copy is deep; 'mutated-nested' => nested AA shared"
end sub

' --------------------------------------------------------------------------------------------
' S4 -- assocarray field holding a node. S4.6/S4.7 are DECISIVE for Q-B.
' --------------------------------------------------------------------------------------------
sub runS4(utils as Object, scene as Object)
    print "--- S4: node inside an assocarray field ---"
    agent = newAgent("s4-token")
    scene.services = { a: agent, b: agent }
    r1 = scene.services

    say("S4.1  IsSameObject vs original      ", utils.IsSameObject(r1.a, agent))
    say("S4.2  isSameNode vs original        ", r1.a.isSameNode(agent))
    say("S4.3  two entries of ONE read       ", utils.IsSameObject(r1.a, r1.b))
    r2 = scene.services
    say("S4.4  two separate reads            ", utils.IsSameObject(r1.a, r2.a))
    say("S4.5  callFunc readToken through it ", r1.a.callFunc("readToken"))
    print "        ^ 's4-token' => script scope intact; 'UNSET' => scope-less clone"

    r1.a.marker = "via-aa-field"
    say("S4.6  FIELD write -> original.marker", agent.marker)
    print "        ^ 'via-aa-field' => SAME node; 'orig-marker' => real duplicate"

    r1.a.callFunc("configure", "via-aa-field")
    say("S4.7  callFunc write -> orig token  ", agent.callFunc("readToken"))
    print "        ^ 'via-aa-field' => SAME node; 's4-token' => real duplicate"

    agent.addField("lateField", "string", false)
    agent.lateField = "added-late"
    r3 = scene.services
    say("S4.8  addField on orig, fresh read  ", r3.a.lateField)
    print "        ^ 'added-late' => same node; 'invalid' => duplicate snapshot"

    agent.appendChild(CreateObject("roSGNode", "Rectangle"))
    say("S4.9  orig childCount               ", agent.getChildCount())
    say("S4.10 stale copy childCount         ", r1.a.getChildCount())
    r4 = scene.services
    say("S4.11 fresh copy childCount         ", r4.a.getChildCount())
end sub

' --------------------------------------------------------------------------------------------
' S5 -- array field holding a node.
' --------------------------------------------------------------------------------------------
sub runS5(utils as Object, scene as Object)
    print "--- S5: node inside an array field ---"
    agent = newAgent("s5-token")
    scene.agents = [agent, agent]
    r1 = scene.agents

    say("S5.1  IsSameObject vs original      ", utils.IsSameObject(r1[0], agent))
    say("S5.2  isSameNode vs original        ", r1[0].isSameNode(agent))
    say("S5.3  two elements of ONE read      ", utils.IsSameObject(r1[0], r1[1]))
    say("S5.4  callFunc readToken through it ", r1[0].callFunc("readToken"))

    r1[0].marker = "via-array-field"
    say("S5.5  FIELD write -> original.marker", agent.marker)
    print "        ^ 'via-array-field' => SAME node; 'orig-marker' => real duplicate"

    r1[0].callFunc("configure", "via-array-field")
    say("S5.6  callFunc write -> orig token  ", agent.callFunc("readToken"))
end sub

' --------------------------------------------------------------------------------------------
' S6 -- roUtils.DeepCopy applied to the NODE ITSELF.
' --------------------------------------------------------------------------------------------
sub runS6(utils as Object)
    print "--- S6: roUtils.DeepCopy(<the node itself>) ---"
    agent = newAgent("s6-token")
    agent.id = "S6Agent"
    agent.appendChild(CreateObject("roSGNode", "Rectangle"))

    copy = utils.DeepCopy(agent)
    say("S6.1  returned type                 ", typeOf(copy))
    if copy = invalid
        print "        ^ invalid => a device treats an roSGNode as NOT copyable"
        return
    end if
    say("S6.2  IsSameObject vs original      ", utils.IsSameObject(copy, agent))
    say("S6.3  isSameNode vs original        ", copy.isSameNode(agent))
    say("S6.4  callFunc readToken            ", copy.callFunc("readToken"))
    print "        ^ 's6-token' => scope carried; 'UNSET' => fresh scope-less node"
    say("S6.5  marker field                  ", copy.marker)
    say("S6.6  id field                      ", copy.id)
    say("S6.7  childCount (orig has 1)       ", copy.getChildCount())

    copy.marker = "via-deepcopy-node"
    say("S6.8  FIELD write -> original.marker", agent.marker)
    print "        ^ 'via-deepcopy-node' => SAME node; 'orig-marker' => real duplicate"

    copy.callFunc("configure", "via-deepcopy-node")
    say("S6.9  callFunc write -> orig token  ", agent.callFunc("readToken"))
end sub

' --------------------------------------------------------------------------------------------
' S7 -- roUtils.DeepCopy applied to an AA CONTAINING a node (and other member kinds).
' --------------------------------------------------------------------------------------------
sub runS7(utils as Object)
    print "--- S7: roUtils.DeepCopy({ node, nested AA, non-copyables }) ---"
    agent = newAgent("s7-token")
    dt = CreateObject("roDateTime")
    src = { agent: agent, nested: { n: "orig-n" }, dev: CreateObject("roDeviceInfo"), when: dt }

    copy = utils.DeepCopy(src)
    say("S7.1  returned type                 ", typeOf(copy))
    say("S7.2  member 'agent' type           ", typeOf(copy.agent))
    say("S7.3  member 'dev' type             ", typeOf(copy.dev))
    print "        ^ docs say a non-copyable member comes back invalid"
    say("S7.4  member 'when' type            ", typeOf(copy.when))
    say("S7.5  member 'when' IsSameObject    ", sameObjOrNA(utils, copy.when, dt))

    if copy.agent <> invalid
        say("S7.6  node IsSameObject vs original ", utils.IsSameObject(copy.agent, agent))
        say("S7.7  node isSameNode vs original   ", copy.agent.isSameNode(agent))
        say("S7.8  callFunc readToken through it ", copy.agent.callFunc("readToken"))
        print "        ^ 's7-token' => scope intact; 'UNSET' => scope-less clone"

        copy.agent.marker = "via-deepcopy-aa"
        say("S7.9  FIELD write -> orig.marker    ", agent.marker)
        print "        ^ 'via-deepcopy-aa' => SAME node; 'orig-marker' => real duplicate"

        copy.agent.callFunc("configure", "via-deepcopy-aa")
        say("S7.10 callFunc write -> orig token  ", agent.callFunc("readToken"))
    end if

    copy.nested.n = "mutated-copy-nested"
    say("S7.11 mutate copy nested -> orig    ", src.nested.n)
    print "        ^ 'orig-n' => DeepCopy is deep for AAs"
end sub

' --------------------------------------------------------------------------------------------
' S8 -- node.clone() for comparison: does a device's own clone carry the script scope?
' --------------------------------------------------------------------------------------------
sub runS8(utils as Object)
    print "--- S8: node.clone() for comparison ---"
    agent = newAgent("s8-token")
    agent.id = "S8Agent"
    agent.appendChild(CreateObject("roSGNode", "Rectangle"))

    shallow = agent.clone(false)
    say("S8.1  clone(false) type             ", typeOf(shallow))
    say("S8.2  clone(false) IsSameObject     ", sameObjOrNA(utils, shallow, agent))
    say("S8.3  clone(false) isSameNode       ", sameNodeOrNA(shallow, agent))
    say("S8.4  clone(false) readToken        ", callTokenOrNA(shallow))
    print "        ^ 's8-token' => clone carries the script scope; 'UNSET' => it does not"
    say("S8.5  clone(false) marker           ", fieldOrNA(shallow, "marker"))
    say("S8.6  clone(false) childCount       ", childCountOrNA(shallow))

    deep = agent.clone(true)
    say("S8.7  clone(true) readToken         ", callTokenOrNA(deep))
    say("S8.8  clone(true) childCount        ", childCountOrNA(deep))

    if shallow <> invalid
        shallow.marker = "via-clone"
        say("S8.9  clone FIELD write -> orig     ", agent.marker)
        print "        ^ 'orig-marker' expected: a clone must be a real duplicate"
    end if
end sub

' --------------------------------------------------------------------------------------------
' S9 -- moveIntoField / moveFromField with a node inside. The last copy path still unmeasured:
'       ifSGNodeField says the data is moved "unless external references are present", and a node
'       always has those, so the spec does not say whether the node survives as itself.
' --------------------------------------------------------------------------------------------
sub runS9(utils as Object, scene as Object)
    print "--- S9: moveIntoField / moveFromField holding a node ---"
    agent = newAgent("s9-token")
    src = { agent: agent, plain: "orig-plain" }

    rc = scene.moveIntoField("services", src)
    say("S9.1  moveIntoField return         ", rc)
    say("S9.2  source emptied (count)       ", src.Count())
    print "        ^ 0 => the AA was moved out"

    moved = scene.services
    say("S9.3  member 'agent' type          ", typeOf(moved.agent))
    if moved.agent = invalid
        print "        ^ invalid => the node did not survive moveIntoField at all"
    else
        say("S9.4  callFunc readToken through it ", moved.agent.callFunc("readToken"))
        print "        ^ 's9-token' => scope intact; 'UNSET' => scope-less clone"
        say("S9.5  isSameNode vs original       ", moved.agent.isSameNode(agent))
        say("S9.6  IsSameObject vs original     ", utils.IsSameObject(moved.agent, agent))
        moved.agent.marker = "via-moveintofield"
        say("S9.7  FIELD write -> orig.marker   ", agent.marker)
        print "        ^ 'via-moveintofield' => SAME node; 'orig-marker' => real duplicate"
        moved.agent.callFunc("configure", "via-moveintofield")
        say("S9.8  callFunc write -> orig token ", agent.callFunc("readToken"))
    end if

    taken = scene.moveFromField("services")
    say("S9.9  moveFromField member type    ", typeOf(taken.agent))
    say("S9.10 moveFromField readToken      ", callTokenOrNA(taken.agent))
    say("S9.11 field cleared after move     ", typeOf(scene.services))
end sub

' --------------------------------------------------------------------------------------------
' S10 -- a clone's NODE-VALUED field. The engine routes it through the same duplicate path as
'        moveIntoField, and whether a device shares or duplicates it is unresolved.
' --------------------------------------------------------------------------------------------
sub runS10(utils as Object)
    print "--- S10: clone(true) and its node-valued field ---"
    parent = CreateObject("roSGNode", "ContentNode")
    kid = newAgent("s10-token")
    parent.addFields({ kid: kid, plain: "orig-plain" })

    cl = parent.clone(true)
    if cl = invalid
        print "  S10.1 clone returned invalid"
        return
    end if
    say("S10.1 clone.kid type               ", typeOf(cl.kid))
    if cl.kid = invalid then return
    say("S10.2 clone.kid isSameNode vs kid  ", cl.kid.isSameNode(kid))
    say("S10.3 clone.kid IsSameObject vs kid", utils.IsSameObject(cl.kid, kid))
    say("S10.4 clone.kid readToken          ", cl.kid.callFunc("readToken"))
    print "        ^ 's10-token' => scope intact; 'UNSET' => scope-less clone"

    cl.kid.marker = "via-clone-nodefield"
    say("S10.5 write -> original kid.marker ", kid.marker)
    print "        ^ 'via-clone-nodefield' => SHARED; 'orig-marker' => duplicated"

    ' setRef metadata must survive a clone regardless of which of the two it is.
    parent.addField("refField", "assocarray", false)
    parent.setRef("refField", { a: 1 })
    cl2 = parent.clone(true)
    say("S10.6 orig canGetRef('refField')   ", parent.canGetRef("refField"))
    say("S10.7 clone canGetRef('refField')  ", cl2.canGetRef("refField"))
    print "        ^ clone must keep the field's by-ref flag"
end sub

' --------------------------------------------------------------------------------------------
' S11 -- what happens to a member the copy CANNOT copy when an AA is assigned to a node field?
'
' S3 showed the container itself is copied on both set and read. S7.3/S7.4 showed roUtils.DeepCopy
' answers `invalid` for a non-copyable member. What was never measured is whether a FIELD assignment
' behaves the same way (DROP) or carries such members over. It matters: the engine currently CARRIES
' them, because dropping silently deletes app data -- `node.cfg = { url: u, onDone: someFunction }`
' losing `onDone` is invisible until the callback is invoked.
' --------------------------------------------------------------------------------------------
sub runS11(utils as Object, scene as Object)
    print "--- S11: uncopyable members through an assocarray FIELD ---"
    agent = newAgent("s11-token")
    src = {
        s: "keep-me",
        nested: { k: "nested-v" },
        node: agent,
        fn: probeCallback,
        when: CreateObject("roDateTime"),
        ba: CreateObject("roByteArray"),
        port: CreateObject("roMessagePort"),
        dev: CreateObject("roDeviceInfo")
    }
    scene.services = src
    back = scene.services
    say("S11.1  member count (src has 8)   ", countOf(back))
    say("S11.2  s      string   (control)  ", memberType(back, "s"))
    say("S11.3  nested AA       (control)  ", memberType(back, "nested"))
    say("S11.4  node   roSGNode (known ok) ", memberType(back, "node"))
    say("S11.5  fn     function reference  ", memberType(back, "fn"))
    say("S11.6  when   roDateTime          ", memberType(back, "when"))
    say("S11.7  ba     roByteArray         ", memberType(back, "ba"))
    say("S11.8  port   roMessagePort       ", memberType(back, "port"))
    say("S11.9  dev    roDeviceInfo        ", memberType(back, "dev"))
    print "        ^ 'invalid' => a field assignment DROPS it, exactly like roUtils.DeepCopy"
    print "        ^ the real type => it CARRIES it (what the engine does today)"

    print "--- S11b: the same question through an ARRAY field ---"
    scene.agents = [probeCallback, CreateObject("roDateTime"), "keep-me"]
    arr = scene.agents
    say("S11.10 array count (src has 3)    ", countOf(arr))
    say("S11.11 array[0] function reference", elemType(arr, 0))
    say("S11.12 array[1] roDateTime        ", elemType(arr, 1))
    say("S11.13 array[2] string  (control) ", elemType(arr, 2))

    print "--- S11c: roUtils.DeepCopy on the SAME shape, side by side ---"
    dc = utils.DeepCopy(src)
    say("S11.14 DeepCopy fn                ", memberType(dc, "fn"))
    say("S11.15 DeepCopy when              ", memberType(dc, "when"))
    say("S11.16 DeepCopy node              ", memberType(dc, "node"))
    print "        ^ if S11.5/S11.6 match S11.14/S11.15, a field assignment behaves like DeepCopy"
end sub

' --------------------------------------------------------------------------------------------
' S12 -- a container with a back-pointer, assigned to a node field. Copying it needs a cycle guard;
'        without one the engine overflowed its stack on the assignment. Does a device preserve the
'        cycle, break it, or refuse the assignment?
' --------------------------------------------------------------------------------------------
sub runS12(scene as Object)
    print "--- S12: a CYCLIC container assigned to a node field ---"
    parent = { name: "p" }
    child = { name: "c", parent: parent }
    parent.child = child

    assigned = true
    try
        scene.services = parent
    catch e
        assigned = false
        print "  S12.1  assign ABORTED: " + e.message
    end try
    if not assigned then return

    say("S12.1  assign survived            ", true)
    r = scene.services
    say("S12.2  r.name                     ", strMember(r, "name"))
    say("S12.3  r.child                    ", memberType(r, "child"))
    say("S12.4  r.child.parent             ", nestedType(r, "child", "parent"))
    say("S12.5  cycle closed -> name       ", cycleName(r))
    print "        ^ .5 = 'c' => the cycle is preserved; 'no-parent'/'invalid' => it was broken"
end sub

sub probeCallback()
end sub

' -------------------------------------- helpers ---------------------------------------------

function newAgent(token as String) as Object
    agent = CreateObject("roSGNode", "Agent")
    agent.callFunc("configure", token)
    return agent
end function

sub say(label as String, value as Dynamic)
    print "  " + label + " = " + fmt(value)
end sub

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"
    t = type(v)
    if t = "Boolean" or t = "roBoolean"
        if v then return "true"
        return "false"
    end if
    if t = "String" or t = "roString" then return v
    if t = "Integer" or t = "roInt" or t = "roInteger" or t = "Float" or t = "roFloat" or t = "Double" or t = "roDouble"
        return Str(v).Trim()
    end if
    return t
end function

function typeOf(v as Dynamic) as String
    if v = invalid then return "invalid"
    return type(v)
end function

function countOf(c as Dynamic) as String
    if c = invalid then return "n/a"
    return fmt(c.Count())
end function

function memberType(aa as Dynamic, key as String) as String
    if aa = invalid then return "n/a"
    if type(aa) <> "roAssociativeArray" then return type(aa)
    v = aa[key]
    if v = invalid then return "invalid"
    return type(v)
end function

function strMember(aa as Dynamic, key as String) as String
    if aa = invalid then return "n/a"
    if type(aa) <> "roAssociativeArray" then return type(aa)
    return fmt(aa[key])
end function

function nestedType(aa as Dynamic, k1 as String, k2 as String) as String
    if aa = invalid then return "n/a"
    if type(aa) <> "roAssociativeArray" then return type(aa)
    inner = aa[k1]
    if inner = invalid then return "invalid"
    if type(inner) <> "roAssociativeArray" then return type(inner)
    return memberType(inner, k2)
end function

function cycleName(r as Dynamic) as String
    if r = invalid then return "n/a"
    c = r.child
    if c = invalid or type(c) <> "roAssociativeArray" then return "no-child"
    p = c.parent
    if p = invalid or type(p) <> "roAssociativeArray" then return "no-parent"
    c2 = p.child
    if c2 = invalid or type(c2) <> "roAssociativeArray" then return "no-child2"
    return strMember(c2, "name")
end function

function elemType(arr as Dynamic, i as Integer) as String
    if arr = invalid then return "n/a"
    if type(arr) <> "roArray" then return type(arr)
    if i >= arr.Count() then return "out-of-range"
    v = arr[i]
    if v = invalid then return "invalid"
    return type(v)
end function

function sameObjOrNA(utils as Object, a as Dynamic, b as Dynamic) as String
    if a = invalid or b = invalid then return "n/a"
    return fmt(utils.IsSameObject(a, b))
end function

function sameNodeOrNA(a as Dynamic, b as Dynamic) as String
    if a = invalid or b = invalid then return "n/a"
    return fmt(a.isSameNode(b))
end function

function callTokenOrNA(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.callFunc("readToken"))
end function

function fieldOrNA(n as Dynamic, name as String) as String
    if n = invalid then return "n/a"
    return fmt(n.getField(name))
end function

function childCountOrNA(n as Dynamic) as String
    if n = invalid then return "n/a"
    return fmt(n.getChildCount())
end function
