' SceneGraph AnimatedImage: the size an empty node reports, and whether a loaded node that never plays shows its first
' frame. The scene prints its readouts, then "PROBE|shot" for run-device.sh to take a screenshot.
sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.Show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.IsScreenClosed() then return
    end while
end sub
