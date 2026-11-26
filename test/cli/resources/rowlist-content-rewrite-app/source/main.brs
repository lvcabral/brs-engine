' Runs test/simulator/probes/rowlist-content-rewrite-probe's cases (its device trace is the expectation).
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("RewriteProbeScene")
    screen.show()
    for i = 0 to 200
        wait(20, port)
        if scene.probeExit then exit for
    end for
end sub
