' Nested Forward Focus Probe - entry point. Mirrors the Popcorn gallery's modal -> gallery -> list ->
' button focus forwarding and logs every button's focusedChild change and hasFocus().
sub Main(args as dynamic)
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    sceneName = "ProbeScene"
    if args <> invalid and args.mode = "links" then sceneName = "LinksScene"
    screen.CreateScene(sceneName)
    screen.show()
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" and msg.isScreenClosed() then exit while
    end while
end sub
