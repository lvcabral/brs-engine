sub init()
    m.top.functionName = "probeLoop"
end sub

' Runs on the dedicated task thread once control="run" starts it; keeps it alive to service the
' callFunc rendezvous used by this probe.
sub probeLoop()
    while true
        sleep(50)
    end while
end sub

function receiveArgs(arr as object) as string
    return describe(arr[0])
end function

function describe(v as dynamic) as string
    return type(v) + "|" + type(v, 3) + "|" + v
end function
