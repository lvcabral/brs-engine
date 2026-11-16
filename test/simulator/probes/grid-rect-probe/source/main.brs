sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.createScene("GridRectScene")
    screen.show()
    sleep(2000)
    print "PROBE|boot|res="; scene.currentDesignResolution.resolution
    for each name in scene.callFunc("caseNames", invalid)
        states = scene.callFunc("setup", name)
        for s = 0 to states - 1
            scene.callFunc("act", { name: name, s: s })
            sleep(1200)
            scene.callFunc("measure", { name: name, s: s })
        end for
        scene.callFunc("teardown", name)
    end for
    print "PROBE|done"
end sub
