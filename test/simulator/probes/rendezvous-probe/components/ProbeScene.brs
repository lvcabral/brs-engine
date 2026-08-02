' Render-thread side of the probe. Owns the state the task rendezvouses against, maps remote keys
' to phases, and can deliberately block the render thread so a rendezvous takes a known long time.

sub init()
    m.top.backgroundURI = ""
    m.top.backgroundColor = "0x101020FF"

    ' Every field the task touches lives on m.global, which is owned by the render thread, so each
    ' access from the task thread is unambiguously a rendezvous. The target node is created first so
    ' addFields infers the field type from it — declaring it as `invalid` leaves the field untyped
    ' and the later assignment fails with "Tried to set nonexistent field".
    target = CreateObject("roSGNode", "ProbeTarget")
    m.global.addFields({
        probeCounter: 41
        probeSink: 0
        probeNode: target
    })

    m.keymap = m.top.findNode("keymap")
    m.status = m.top.findNode("status")
    m.spinTimer = m.top.findNode("spinTimer")
    m.spinTimer.observeField("fire", "onSpinTimer")
    m.keymap.text = [
        "RENDEZVOUS PROBE"
        ""
        "UP       get    5 unrolled m.global reads      (expect 5 + 1)"
        "DOWN     set    5 unrolled m.global writes     (expect 5 + 1)"
        "LEFT     call   5 unrolled callFunc            (expect 5 + 1)"
        "RIGHT    local  200 ops on a task-owned node   (expect 0 + 1)"
        "OK       slow   1 read while render busy 2000ms (expect 1 + 1)"
        "OPTIONS  flood  1500 reads in a tight loop     (expect 1500 + 1)"
        "BACK            exit"
        ""
        "The '+ 1' is the task's closing write to m.top.phaseDone."
    ].join(chr(10))

    m.task = CreateObject("roSGNode", "ProbeTask")
    m.task.observeField("phaseDone", "onPhaseDone")
    m.task.control = "RUN"

    m.top.setFocus(true)
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    if key = "up"
        startPhase("get")
    else if key = "down"
        startPhase("set")
    else if key = "left"
        startPhase("call")
    else if key = "right"
        startPhase("local")
    else if key = "OK"
        startPhase("slow")
        ' Deferred to the timer: see the comment on spinTimer in the XML.
        m.spinTimer.control = "start"
    else if key = "options"
        startPhase("flood")
    else
        return false
    end if

    return true
end function

sub startPhase(phase as string)
    print "### RENDER requesting phase "; phase
    m.status.text = "running phase: " + phase
    m.task.phase = phase
end sub

sub onPhaseDone(event as object)
    data = event.getData()
    print "### RENDER phaseDone = "; data
    m.status.text = "done: " + data
end sub

' Blocks the render thread's message loop for 2000 ms. The task is issuing spaced reads across this
' window, so the ones landing inside it cannot be served until the spin ends.
sub onSpinTimer(event as object)
    print "### RENDER busy-spin BEGIN"
    busySpin(2000)
    print "### RENDER busy-spin END"
end sub

' Spins without yielding, unlike sleep(), so the render thread stays off its message loop.
sub busySpin(ms as integer)
    span = CreateObject("roTimespan")
    span.mark()
    while span.totalMilliseconds() < ms
    end while
end sub
