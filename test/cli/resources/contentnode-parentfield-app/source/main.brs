sub Main()
    print "=== ContentNode ParentField Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("ParentFieldScene")
    screen.show()

    sleep(400)

    print "=== ContentNode ParentField Repro Complete ==="
end sub
