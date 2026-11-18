' Device-measured (test/simulator/probes/sgscreen-close-probe): closing the last screen ends the app
' (EXIT_USER_NAV) once Main returns to its message loop.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    screen.close()
    print "close returns"
    msg = wait(0, port)
    print "unreachable: the app ends when its last screen closes"
end sub
