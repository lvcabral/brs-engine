sub init()
    m.seq = 0
    m.step = 0
    m.clock = CreateObject("roTimespan")
    m.fires = {}
    m.timers = {}
    m.driver = m.top.findNode("driver")
    m.driver.observeField("fire", "onStep")
    m.driver.control = "start"
    runStep()
end sub

sub trace(name as string, detail as string)
    m.seq = m.seq + 1
    print "PROBE|" + Right("00" + m.seq.toStr(), 3) + "|" + name + "|" + detail
end sub

' Elapsed time in 100 ms buckets, so frame jitter does not change the trace.
function bucket(startMs as integer) as string
    return Int((m.clock.TotalMilliseconds() - startMs + 50) / 100).toStr()
end function

function newTimer(id as string, duration as float, repeating as boolean) as object
    t = CreateObject("roSGNode", "Timer")
    t.id = id
    t.duration = duration
    t.repeat = repeating
    t.observeField("fire", "onFire")
    t.observeField("control", "onControl")
    m.timers[id] = t
    m.fires[id] = 0
    return t
end function

sub onFire(event as object)
    t = event.getRoSGNode()
    id = t.id
    m.fires[id] = m.fires[id] + 1
    detail = "fires=" + m.fires[id].toStr() + " control=" + t.control
    if t.startMs <> invalid then detail = detail + " at=" + bucket(t.startMs)
    trace(id + ".onFire", detail)
    if id = "G" and m.fires.G = 1
        t.control = "start"
        trace("G.selfRestart", "control=" + t.control)
    end if
end sub

sub onControl(event as object)
    t = event.getRoSGNode()
    trace(t.id + ".onControl", "data=" + event.getData())
end sub

sub start(t as object)
    t.addField("startMs", "integer", false)
    t.startMs = m.clock.TotalMilliseconds()
    t.control = "start"
end sub

sub onStep()
    m.step = m.step + 1
    runStep()
end sub

sub runStep()
    s = m.step
    if s = 0
        ' A: one-shot lifecycle. The key question: what does control read after the fire?
        a = newTimer("A", 0.3, false)
        trace("A.created", "control=" + a.control)
        start(a)
        trace("A.started", "control=" + a.control)
    else if s = 1
        a = m.timers.A
        trace("A.afterFire", "control=" + a.control + " fires=" + m.fires.A.toStr())
        ' The guard pattern: restart only when control does not already read "start".
        restarted = false
        if a.control <> "start"
            start(a)
            restarted = true
        end if
        trace("A.guard", "restarted=" + restarted.toStr() + " control=" + a.control)
        ' B: a one-shot that is unconditionally set to "start" again after it has fired.
        b = newTimer("B", 0.3, false)
        start(b)
    else if s = 2
        a = m.timers.A
        trace("A.afterGuard", "control=" + a.control + " fires=" + m.fires.A.toStr())
        b = m.timers.B
        trace("B.afterFire", "control=" + b.control + " fires=" + m.fires.B.toStr())
        start(b)
        trace("B.restarted", "control=" + b.control)
        ' C: a repeating timer.
        c = newTimer("C", 0.3, true)
        start(c)
    else if s = 3
        b = m.timers.B
        trace("B.afterRestart", "control=" + b.control + " fires=" + m.fires.B.toStr())
        c = m.timers.C
        trace("C.running", "control=" + c.control + " firesAtLeast3=" + (m.fires.C >= 3).toStr())
        c.control = "stop"
        trace("C.stopped", "control=" + c.control)
        ' D: start again while running, 0.3 s into a 0.5 s countdown. A restart fires at ~0.8 s, else ~0.5 s.
        d = newTimer("D", 0.5, false)
        start(d)
        m.dStart = d.startMs
    else if s = 4
        ' (D's restart is issued from the half-step below.)
        trace("D.afterFire", "control=" + m.timers.D.control + " fires=" + m.fires.D.toStr())
        ' E: control = "none" on a running timer - inert, or does it stop?
        e = newTimer("E", 0.3, false)
        start(e)
        e.control = "none"
        trace("E.none", "control=" + e.control)
        ' F: odd values.
        f = newTimer("F", 0.3, false)
        f.control = "stop"
        trace("F.stopBeforeStart", "control=" + f.control)
        f.control = "foo"
        trace("F.unknown", "control=" + f.control)
        f.control = "START"
        trace("F.upper", "control=" + f.control)
        m.fStart = m.clock.TotalMilliseconds()
    else if s = 5
        trace("E.afterNone", "control=" + m.timers.E.control + " fires=" + m.fires.E.toStr())
        trace("F.afterUpper", "control=" + m.timers.F.control + " fires=" + m.fires.F.toStr())
        m.timers.F.control = "stop"
        ' G: a one-shot that restarts itself from its own fire observer (see onFire). Does the
        ' device's automatic "stop" after the fire cancel the restart?
        g = newTimer("G", 0.3, false)
        start(g)
        ' H: an unknown control value on a running timer - inert, or does it stop?
        h = newTimer("H", 0.3, false)
        start(h)
        h.control = "foo"
        trace("H.unknown", "control=" + h.control)
    else if s = 6
        trace("G.afterSelfRestart", "control=" + m.timers.G.control + " fires=" + m.fires.G.toStr())
        trace("H.afterUnknown", "control=" + m.timers.H.control + " fires=" + m.fires.H.toStr())
        m.timers.G.control = "stop"
        m.driver.control = "stop"
        trace("end", "")
        m.top.probeExit = true
    end if
    if s = 3
        ' Half-step for case D: restart 0.3 s in.
        m.half = CreateObject("roSGNode", "Timer")
        m.half.duration = 0.3
        m.half.observeField("fire", "onHalf")
        m.half.control = "start"
    end if
end sub

sub onHalf()
    d = m.timers.D
    d.control = "start"
    trace("D.restartWhileRunning", "control=" + d.control + " at=" + bucket(m.dStart))
end sub
