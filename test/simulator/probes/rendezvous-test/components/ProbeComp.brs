sub init()
    ' Runs on whichever thread created this node — the render thread here.
    m.createdIn = "render"
    m.callCount = 0
end sub

function report(unused as Dynamic) as Object
    m.callCount = m.callCount + 1
    return { createdIn: m.createdIn, callCount: m.callCount }
end function
