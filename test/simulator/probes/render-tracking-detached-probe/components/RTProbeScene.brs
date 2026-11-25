' Cases (T runs first, before any render-thread node enables tracking):
'   T  A Group built and tracked on a Task thread, handed to render, attached, then removed.
'   A  Group (enableRenderTracking) with a Label child; the LABEL is measured while the group is
'      detached, then the group is attached. (The shape of a button that measures its own label
'      from an observer before its owner appends it.)
'   B  Same, but the detached GROUP itself is measured.
'   C  A group tracked inside a detached parent; the parent's subtree is measured, then attached.
'   D  A tracked group with no measurement before attach (control).
'   E  Case D's group removed from the scene after it rendered, then measured while detached.
'   G  What an enableRenderTracking observer reads as tracking is turned on and off.
'   F  A tracked group measured between appendChild and the next frame.
'   H  A tracked StandardMessageDialog (with a tracked child) closed, replaced, and cleared.
'   I  A tracked group with a tracked label: the group hidden, shown, faded to 0 and restored.
sub init()
    m.seq = 0
    m.step = 0
    m.t = invalid
    m.task = CreateObject("roSGNode", "RTProbeTask")
    m.task.observeField("result", "onTaskResult")
    m.task.control = "run"
    m.timer = m.top.findNode("stepTimer")
    m.timer.observeField("fire", "onStep")
    m.timer.control = "start"
end sub

sub trace(caseId as string, label as string, value as string)
    m.seq = m.seq + 1
    s = m.seq.toStr()
    while len(s) < 3
        s = "0" + s
    end while
    print "PROBE|" + s + "|" + caseId + "|" + label + "|" + value
end sub

function makeTracked(id as string) as object
    g = CreateObject("roSGNode", "Group")
    g.id = id
    g.translation = [100, 100]
    lbl = g.createChild("Label")
    lbl.id = id + "_label"
    lbl.text = "Probe " + id
    g.enableRenderTracking = true
    g.observeField("renderTracking", "onTracking")
    return g
end function

sub onTracking(event as object)
    node = event.getRoSGNode()
    trace(node.id, "event", "renderTracking=" + event.getData())
end sub

sub rectStr(caseId as string, label as string, r as object)
    trace(caseId, label, "x=" + r.x.toStr() + " y=" + r.y.toStr() + " w=" + r.width.toStr() + " h=" + r.height.toStr())
end sub

' The device notifies `result` again whenever the node's renderTracking changes, so this traces
' every notification but registers the tracking observer once.
sub onTaskResult(event as object)
    node = event.getData()
    trace("T", "arrived", "renderTracking=" + node.renderTracking + " enable=" + node.enableRenderTracking.toStr())
    if m.t = invalid
        m.t = node
        m.t.observeField("renderTracking", "onTracking")
    end if
end sub

sub onStep()
    m.step = m.step + 1
    if m.step = 2
        trace("T", "beforeAttach", "renderTracking=" + m.t.renderTracking)
        m.top.appendChild(m.t)
        trace("T", "attached", "renderTracking=" + m.t.renderTracking)
    else if m.step = 4
        trace("T", "settled", "renderTracking=" + m.t.renderTracking)
        m.top.removeChild(m.t)
        trace("T", "removed", "renderTracking=" + m.t.renderTracking)
    else if m.step = 6
        trace("T", "final", "renderTracking=" + m.t.renderTracking)
    else if m.step = 8
        ' Build and measure every case while detached
        m.a = makeTracked("A")
        trace("A", "created", "renderTracking=" + m.a.renderTracking)
        rectStr("A", "labelLocalRect", m.a.getChild(0).localBoundingRect())
        trace("A", "afterMeasure", "renderTracking=" + m.a.renderTracking)

        m.b = makeTracked("B")
        trace("B", "created", "renderTracking=" + m.b.renderTracking)
        rectStr("B", "groupRect", m.b.boundingRect())
        trace("B", "afterMeasure", "renderTracking=" + m.b.renderTracking)

        m.cParent = CreateObject("roSGNode", "Group")
        m.c = makeTracked("C")
        m.cParent.appendChild(m.c)
        trace("C", "created", "renderTracking=" + m.c.renderTracking)
        rectStr("C", "parentRect", m.cParent.boundingRect())
        trace("C", "afterMeasure", "renderTracking=" + m.c.renderTracking)

        m.d = makeTracked("D")
        trace("D", "created", "renderTracking=" + m.d.renderTracking)
    else if m.step = 9
        trace("all", "beforeAttach", "A=" + m.a.renderTracking + " B=" + m.b.renderTracking + " C=" + m.c.renderTracking + " D=" + m.d.renderTracking)
        m.top.appendChild(m.a)
        m.top.appendChild(m.b)
        m.top.appendChild(m.cParent)
        m.top.appendChild(m.d)
        trace("all", "attached", "A=" + m.a.renderTracking + " B=" + m.b.renderTracking + " C=" + m.c.renderTracking + " D=" + m.d.renderTracking)
    else if m.step = 11
        trace("all", "settled", "A=" + m.a.renderTracking + " B=" + m.b.renderTracking + " C=" + m.c.renderTracking + " D=" + m.d.renderTracking)
        m.top.removeChild(m.d)
        trace("E", "removed", "renderTracking=" + m.d.renderTracking)
    else if m.step = 13
        trace("E", "detachedSettled", "renderTracking=" + m.d.renderTracking)
        rectStr("E", "groupRect", m.d.boundingRect())
        trace("E", "afterMeasure", "renderTracking=" + m.d.renderTracking)
    else if m.step = 15
        trace("E", "final", "renderTracking=" + m.d.renderTracking)
    else if m.step = 16
        ' G: what an enableRenderTracking observer reads
        m.g = CreateObject("roSGNode", "Group")
        m.g.id = "G"
        m.g.observeField("enableRenderTracking", "onEnableChanged")
        m.g.enableRenderTracking = true
        trace("G", "afterEnable", "renderTracking=" + m.g.renderTracking)
        m.g.enableRenderTracking = false
        trace("G", "afterDisable", "renderTracking=" + m.g.renderTracking)
        ' F: measured between appendChild and the next frame
        m.f = makeTracked("F")
        m.top.appendChild(m.f)
        trace("F", "attached", "renderTracking=" + m.f.renderTracking)
        rectStr("F", "groupRect", m.f.boundingRect())
        trace("F", "afterGroupMeasure", "renderTracking=" + m.f.renderTracking)
        rectStr("F", "labelLocalRect", m.f.getChild(0).localBoundingRect())
        trace("F", "afterLabelMeasure", "renderTracking=" + m.f.renderTracking)
    else if m.step = 18
        trace("F", "settled", "renderTracking=" + m.f.renderTracking)
        ' H: a tracked dialog and a tracked child of it
        m.h1 = makeDialog("H1")
        m.top.dialog = m.h1
        traceDialog("H1", "shown", m.h1)
    else if m.step = 20
        traceDialog("H1", "settled", m.h1)
        m.h1.close = true
        traceDialog("H1", "closeSet", m.h1)
    else if m.step = 22
        traceDialog("H1", "closed", m.h1)
        m.h2 = makeDialog("H2")
        m.top.dialog = m.h2
    else if m.step = 24
        traceDialog("H2", "settled", m.h2)
        m.h3 = makeDialog("H3")
        m.top.dialog = m.h3
        traceDialog("H2", "replacedSync", m.h2)
    else if m.step = 26
        traceDialog("H2", "replaced", m.h2)
        traceDialog("H3", "settled", m.h3)
        m.top.dialog = invalid
        traceDialog("H3", "invalidSync", m.h3)
    else if m.step = 28
        traceDialog("H3", "cleared", m.h3)
        ' I: tracked children of an ancestor that is hidden, then faded out
        m.iParent = makeTracked("I")
        m.iChild = m.iParent.getChild(0)
        m.iChild.id = "I_child"
        m.iChild.enableRenderTracking = true
        m.iChild.observeField("renderTracking", "onTracking")
        m.top.appendChild(m.iParent)
    else if m.step = 30
        traceI("settled")
        m.iParent.visible = false
        traceI("hiddenSync")
    else if m.step = 32
        traceI("hidden")
        m.iParent.visible = true
    else if m.step = 34
        traceI("shownAgain")
        m.iParent.opacity = 0
        traceI("fadedSync")
    else if m.step = 36
        traceI("faded")
        m.iParent.opacity = 1
    else if m.step = 38
        traceI("final")
        m.timer.control = "stop"
        print "PROBE|done"
    end if
end sub

sub traceI(label as string)
    trace("I", label, "parent=" + m.iParent.renderTracking + " child=" + m.iChild.renderTracking)
end sub

sub onEnableChanged(event as object)
    trace("G", "enableEvent", "enable=" + event.getData().toStr() + " renderTracking=" + m.g.renderTracking)
end sub

function makeDialog(id as string) as object
    d = CreateObject("roSGNode", "StandardMessageDialog")
    d.id = id
    d.title = "Probe " + id
    d.message = ["Render tracking probe"]
    d.enableRenderTracking = true
    d.observeField("renderTracking", "onTracking")
    r = CreateObject("roSGNode", "Rectangle")
    r.id = id + "_child"
    r.width = 40
    r.height = 40
    r.enableRenderTracking = true
    r.observeField("renderTracking", "onTracking")
    d.appendChild(r)
    return d
end function

sub traceDialog(caseId as string, label as string, d as object)
    trace(caseId, label, "dialog=" + d.renderTracking + " child=" + d.getChild(d.getChildCount() - 1).renderTracking)
end sub
