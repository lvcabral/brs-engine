sub Main()
    print "=== CallFunc String Boxing Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    target = CreateObject("roSGNode", "Target")

    ' A plain computed (non-literal) string, pushed into an array and crossed via callFunc - the
    ' same-thread call must box it the same way a node field get/set already does.
    plain = []
    plain.push(ucase("computed string"))
    print "callfunc-plain = "; target.callFunc("receiveArgs", plain)

    ' tr() with a translation available returns a fresh string - must also be boxed by callFunc.
    trHit = []
    trHit.push(tr("Hit Key"))
    print "tr-hit-callfunc = "; target.callFunc("receiveArgs", trHit)

    ' tr() with NO translation available must not preserve the caller's literal-ness (real Roku
    ' never returns the same object, hit or miss) - and still gets boxed crossing callFunc.
    trMiss = []
    trMiss.push(tr("Miss Key Not In Table"))
    print "tr-miss-callfunc = "; target.callFunc("receiveArgs", trMiss)

    missRaw = tr("Miss Key Not In Table")
    print "tr-miss-raw = "; type(missRaw) + "|" + type(missRaw, 3)

    print "=== CallFunc String Boxing Repro Complete ==="
end sub
