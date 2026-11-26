' Runs test/simulator/probes/observer-dispatch-mutation-probe's cases (its device trace is the expectation).
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MutationProbeScene")
    screen.show()
    for i = 0 to 100
        wait(20, port)
        if scene.probeExit then exit for
    end for
end sub
