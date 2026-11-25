' Case T, task side: a Group with tracking enabled, built on the task thread and handed to render.
sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    g = CreateObject("roSGNode", "Group")
    g.id = "T"
    g.translation = [100, 300]
    lbl = g.createChild("Label")
    lbl.text = "Probe T"
    print "PROBE|task|T|beforeEnable|renderTracking=" + g.renderTracking
    g.enableRenderTracking = true
    print "PROBE|task|T|afterEnable|renderTracking=" + g.renderTracking
    r = lbl.localBoundingRect()
    print "PROBE|task|T|labelLocalRect|w=" + r.width.toStr() + " h=" + r.height.toStr()
    print "PROBE|task|T|afterMeasure|renderTracking=" + g.renderTracking
    m.top.result = g
end sub
