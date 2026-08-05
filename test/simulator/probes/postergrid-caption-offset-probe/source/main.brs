sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.createScene("CaptionOffsetScene")
    screen.show()

    ' Like postergrid-margins-probe, this app does NOT close its screen when it finishes printing:
    ' the caption ladder stays on screen to be screenshotted. Press Back/Home to exit (under
    ' brs-cli, Ctrl+D, or Ctrl+S first if you want the engine-side PNG).
    scene.callFunc("runProbe", invalid)

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then return
    end while
end sub
