sub init()
    print "PROBE|start"
    readout("init")
    m.timer = CreateObject("roSGNode", "Timer")
    m.timer.duration = 2
    m.timer.ObserveField("fire", "onLoaded")
    m.timer.control = "start"
end sub

sub onLoaded()
    readout("2s")
    print "PROBE|shot"
    m.done = CreateObject("roSGNode", "Timer")
    m.done.duration = 4
    m.done.ObserveField("fire", "onDone")
    m.done.control = "start"
end sub

sub onDone()
    print "PROBE|done"
end sub

sub readout(phase as string)
    for each id in ["empty", "emptySized", "idle", "idleSized", "played", "inRow"]
        node = m.top.FindNode(id)
        print "PROBE|" + phase + "|" + id + "|state=" + node.state + "|media=" + node.mediaWidth.ToStr() + "x" + node.mediaHeight.ToStr() + "|bounds=" + rect(node.BoundingRect()) + "|local=" + rect(node.LocalBoundingRect())
    end for
    right = m.top.FindNode("right")
    print "PROBE|" + phase + "|right|translation=" + right.translation[0].ToStr() + "," + right.translation[1].ToStr() + "|bounds=" + rect(right.BoundingRect())
end sub

function rect(r as object) as string
    return r.x.ToStr() + "," + r.y.ToStr() + "," + r.width.ToStr() + "," + r.height.ToStr()
end function
