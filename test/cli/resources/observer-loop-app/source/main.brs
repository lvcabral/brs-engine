sub Main()
    print "=== Observer Loop Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    ' Trigger from the top level; onSelected then reassigns aliasField from inside its own handler,
    ' so aliasField's onChange (onAlias) runs deferred. onAlias writes aliasField back to itself.
    scene.runTrigger = 1
    for i = 0 to 5
        msg = wait(20, port)
    end for
    print "=== Observer Loop Repro Complete ==="
end sub
