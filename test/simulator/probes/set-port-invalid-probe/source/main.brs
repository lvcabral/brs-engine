' Set Port Invalid Probe: what SetMessagePort()/SetPort() do with a value that is not a roMessagePort.
' Output: PROBE|<section>|... lines, PROBE|done at the end. See README.md.
sub Main(args as object)
    ' The device console drops its clients when the app launches; give the driver time to reconnect.
    sleep(6000)
    print "PROBE|start|run=" + toText(args.run)
    m.url = "http://127.0.0.1:8060/query/device-info"

    argCases()
    urlEvents()
    sceneGraph()
    print "PROBE|done"
end sub

' --- Section 1: argument kinds, per component and method --------------------------------------------

sub argCases()
    comps = [
        ["roUrlTransfer", "SetMessagePort"],
        ["roUrlTransfer", "SetPort"],
        ["roDeviceInfo", "SetMessagePort"],
        ["roTextureManager", "SetMessagePort"],
        ["roAudioPlayer", "SetMessagePort"],
        ["roChannelStore", "SetMessagePort"],
        ["roInput", "SetMessagePort"]
    ]
    kinds = ["invalid", "unset", "roInvalid", "int", "string", "aa", "array", "timespan"]
    for each comp in comps
        ' No port attached before the call.
        obj = CreateObject(comp[0])
        res = callSet(obj, comp[1], invalid)
        print "PROBE|arg|" + comp[0] + "." + comp[1] + "|fresh|invalid|" + res + "|after=" + portType(obj)
        for each kind in kinds
            obj = CreateObject(comp[0])
            port = CreateObject("roMessagePort")
            obj.SetMessagePort(port)
            before = portType(obj)
            res = callSet(obj, comp[1], argOf(kind))
            print "PROBE|arg|" + comp[0] + "." + comp[1] + "|attached|" + kind + "|" + res + "|before=" + before + "|after=" + portType(obj)
        end for
    end for
end sub

function argOf(kind as string) as dynamic
    if kind = "invalid" then return invalid
    if kind = "unset" then return m.neverAssigned
    if kind = "roInvalid" then return CreateObject("roInvalid")
    if kind = "int" then return 5
    if kind = "string" then return "port"
    if kind = "aa" then return {}
    if kind = "array" then return []
    return CreateObject("roTimespan")
end function

function callSet(obj as object, method as string, arg as dynamic) as string
    try
        if method = "SetPort"
            obj.SetPort(arg)
        else
            obj.SetMessagePort(arg)
        end if
        return "ok"
    catch e
        return "err=" + e.number.toStr() + ":" + e.message
    end try
end function

function portType(obj as object) as string
    try
        return type(obj.GetMessagePort())
    catch e
        return "noGetter"
    end try
end function

' --- Section 2: roUrlTransfer events after SetPort(invalid) -----------------------------------------

sub urlEvents()
    ' A port, then invalid: does the old port still get the event?
    oldPort = CreateObject("roMessagePort")
    xfer = newTransfer()
    xfer.SetPort(oldPort)
    xfer.SetPort(invalid)
    started = xfer.AsyncGetToString()
    print "PROBE|event|old-port|async=" + started.toStr() + "|" + eventOf(wait(4000, oldPort))

    ' Invalid on a fresh transfer: does the async call still start?
    xfer2 = newTransfer()
    xfer2.SetPort(invalid)
    print "PROBE|event|no-port|async=" + xfer2.AsyncGetToString().toStr()

    ' Invalid, then a real port: events go to the new port.
    newPort = CreateObject("roMessagePort")
    xfer3 = newTransfer()
    xfer3.SetPort(invalid)
    xfer3.SetPort(newPort)
    started = xfer3.AsyncGetToString()
    print "PROBE|event|new-port|async=" + started.toStr() + "|" + eventOf(wait(4000, newPort))
end sub

function newTransfer() as object
    xfer = CreateObject("roUrlTransfer")
    xfer.SetUrl(m.url)
    return xfer
end function

function eventOf(msg as dynamic) as string
    if msg = invalid then return "msg=invalid"
    return "msg=" + type(msg)
end function

' --- Section 3: roSGScreen.SetMessagePort(invalid) -----------------------------------------------------

sub sceneGraph()
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
    scene = screen.CreateScene("ProbeScene")
    screen.Show()
    sceneStep("attached", scene, port)

    res = callSet(screen, "SetMessagePort", invalid)
    print "PROBE|sg|set-invalid|" + res + "|after=" + portType(screen)
    sceneStep("after-invalid", scene, port)

    port2 = CreateObject("roMessagePort")
    screen.SetMessagePort(port2)
    print "PROBE|sg|set-port2|after=" + portType(screen)
    sceneStep("switched-wait-old", scene, port)
    sceneStep("switched-wait-new", scene, port2)

end sub

' Waits on the port for ~1.5 s and reports whether the scene's repeating Timer kept firing.
sub sceneStep(name as string, scene as object, port as object)
    ticks = scene.ticks
    events = 0
    for i = 1 to 15
        msg = wait(100, port)
        if msg <> invalid then events++
    end for
    state = "frozen"
    if scene.ticks > ticks then state = "advancing"
    print "PROBE|sg|" + name + "|timer=" + state + "|events=" + events.toStr()
end sub

function toText(value as dynamic) as string
    if value = invalid then return "none"
    return value
end function
