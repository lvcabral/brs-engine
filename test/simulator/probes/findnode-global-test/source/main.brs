sub Main()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("MainScene")
    screen.show()

    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent"
            if msg.isScreenClosed() then return
        end if
    end while
end sub

' Deliberately NOT referenced by any component's <script> tag. On a device, functions in
' pkg:/source are in the global scope and callable from any component; this is the probe
' for whether the simulator does the same. See test Q.
function sourceScopeMarker() as String
    return "SOURCE-SCOPE-VISIBLE"
end function
