sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()

    ' The scene's "report" field flips once the task's download loop finishes, so this
    ' probe can close itself and exit rather than waiting for Home/Ctrl+D.
    scene.ObserveField("report", port)

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        else if type(msg) = "roSGNodeEvent"
            screen.close()
        end if
    end while
end sub
