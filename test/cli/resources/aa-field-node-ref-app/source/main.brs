sub Main()
    print "=== AA Field Node Ref ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' A component configured through callFunc, which caches state in its script scope.
    agent = CreateObject("roSGNode", "Agent")
    agent.callFunc("configure", "cached-token")
    print "direct = "; agent.callFunc("readToken")

    ' Stashed inside an assocarray field. Reading the field hands back a copy of the container, but
    ' the component inside it must keep behaving like the component -- device-confirmed.
    scene.services = { agent: agent }
    services = scene.services
    print "aaField = "; services.agent.callFunc("readToken")

    ' Same through an array field.
    scene.agents = [agent]
    list = scene.agents
    print "arrayField = "; list[0].callFunc("readToken")

    ' And through roUtils.DeepCopy, which copies nested objects but still must not turn a component
    ' into a scope-less clone.
    utils = CreateObject("roUtils")
    copied = utils.DeepCopy({ agent: agent })
    print "deepCopy = "; copied.agent.callFunc("readToken")

    ' The invariant is a PAIR, so pin both halves: the container IS copied (mutating the read-back
    ' value must not touch the field) while the node inside is NOT (a write through it must reach
    ' the original). Without these, returning the stored container as-is would still print the
    ' four tokens above and pass.
    services.extra = "mutated-readback"
    print "container copied on read = "; scene.services.extra = invalid
    src = { k: "orig" }
    scene.services = src
    src.k = "mutated-source"
    print "container copied on set = "; scene.services.k = "orig"
    scene.services = { agent: agent }
    services = scene.services
    services.agent.callFunc("configure", "written-through")
    print "write reached original = "; agent.callFunc("readToken")

    print "=== AA Field Node Ref Complete ==="
end sub
