sub main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("Scene")
    screen.show()
    sleep(5000)
    print "PROBE|start"
    n = CreateObject("roSGNode", "PlainInit")
    print "PROBE|plainInit|"; type(n)
    if type(n) = "roSGNode" then
        print "PROBE|plainTypedFloat|"; type(n.callFunc("typedFloat"))
        print "PROBE|plainTypedBool|"; type(n.callFunc("typedBool"))
    end if
    g = CreateObject("roSGNode", "GotoInit")
    print "PROBE|gotoInit|"; type(g)
    if type(g) = "roSGNode" then
        v = g.callFunc("typedFloat")
        print "PROBE|typedFloatCallFunc|"; type(v)
    end if
    x = direct()
    print "PROBE|directGotoReturn|"; type(x); "|"; x
    print "PROBE|done"
    sleep(3000)
end sub

function direct() as float
    if true then
        goto l2
l2:
        return 2
    end if
end function
