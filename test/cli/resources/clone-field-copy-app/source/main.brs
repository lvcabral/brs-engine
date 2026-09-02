sub Main()
    print "=== Clone Field Copy ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    parent = CreateObject("roSGNode", "ContentNode")
    kid = CreateObject("roSGNode", "Agent")
    kid.callFunc("configure", "kid-token")
    parent.addFields({ kid: kid, plain: "orig-plain" })
    parent.addField("refField", "assocarray", false)
    parent.setRef("refField", { a: 1 })

    ' A clone owns its field storage: writing a field on it must not reach the original.
    cl = parent.clone(true)
    print "clone plain = "; cl.plain
    cl.plain = "changed-on-clone"
    print "orig plain after clone write = "; parent.plain

    ' ...and the clone keeps each field's by-ref flag (the 7th Field constructor argument).
    print "orig canGetRef = "; parent.canGetRef("refField")
    print "clone canGetRef = "; cl.canGetRef("refField")
    print "clone getRef type = "; type(cl.getRef("refField"))

    ' ...but a node-valued field is SHARED, not duplicated: only children are copied.
    print "clone.kid isSameNode = "; cl.kid.isSameNode(kid)
    cl.kid.callFunc("configure", "written-via-clone")
    print "orig kid token after clone write = "; kid.callFunc("readToken")

    ' moveIntoField likewise carries the node itself over, script scope included.
    scene.moveIntoField("services", { agent: kid })
    moved = scene.services
    print "moveIntoField readToken = "; moved.agent.callFunc("readToken")
    print "moveIntoField isSameNode = "; moved.agent.isSameNode(kid)

    ' Device quirk: a custom component whose built-in base is exactly `Node` clones to a BARE Node.
    ' Components over any other base (Group/Label/ContentNode/custom) clone with everything intact.
    kid.addField("extra", "string", false)
    kid.extra = "extra-value"
    bare = kid.clone(false)
    print "bare clone subtype = "; bare.subtype()
    print "bare clone isSubtype(Agent) = "; bare.isSubtype("Agent")
    print "bare clone hasField(extra) = "; bare.hasField("extra")
    print "bare clone callFunc = "; bare.callFunc("readToken")

    print "=== Clone Field Copy Complete ==="
end sub
