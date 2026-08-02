' Render-thread-owned node. The task calls `probeAdd` through callFunc, which forces a rendezvous
' because the node belongs to the render thread.

sub init()
    m.top.lastArg = 0
end sub

function probeAdd(n as integer) as integer
    m.top.lastArg = n
    return n + 1
end function
