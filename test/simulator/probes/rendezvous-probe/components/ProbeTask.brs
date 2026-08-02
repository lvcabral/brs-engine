' Task-thread side of the probe. Every line that crosses a thread boundary is tagged with a
' `PROBE-LINE` marker comment, so `grep -n PROBE-LINE components/ProbeTask.brs` yields the ground
' truth to compare against the `line-number` reported by query/sgrendezvous — no hardcoded numbers.

sub init()
    m.top.functionName = "probeLoop"
end sub

sub probeLoop()
    m.port = CreateObject("roMessagePort")
    m.top.observeField("phase", m.port)

    ' Warm-up: fetched once at startup, BEFORE tracking is enabled, so the phase counts below are
    ' not polluted by it. Caching the reference does not make the node task-owned — it still
    ' belongs to the render thread, so each callFunc on it rendezvouses.
    m.probeNode = m.global.probeNode                    ' PROBE-LINE warmup-node

    print "### TASK ready"

    while true
        msg = wait(0, m.port)
        if type(msg) = "roSGNodeEvent"
            phase = msg.getData()
            if phase <> "" then runPhase(phase)
        end if
    end while
end sub

sub runPhase(phase as string)
    print "### PHASE "; phase; " BEGIN"

    if phase = "get"
        doGet()
    else if phase = "set"
        doSet()
    else if phase = "call"
        doCall()
    else if phase = "local"
        doLocal()
    else if phase = "slow"
        doSlow()
    else if phase = "flood"
        doFlood()
    else
        print "### PHASE "; phase; " UNKNOWN"
        return
    end if

    ' A task writing to its own m.top. Kept deliberately: it is the one extra event in every phase
    ' count, and it doubles as a probe of whether this counts as a rendezvous at all.
    m.top.phaseDone = phase                             ' PROBE-LINE phasedone-set
end sub

' --- get: 5 unrolled reads of a render-owned field, each on its own line -------------------------
sub doGet()
    a = m.global.probeCounter                           ' PROBE-LINE get-1
    b = m.global.probeCounter                           ' PROBE-LINE get-2
    c = m.global.probeCounter                           ' PROBE-LINE get-3
    d = m.global.probeCounter                           ' PROBE-LINE get-4
    e = m.global.probeCounter                           ' PROBE-LINE get-5
    print "### PHASE get END expected=5+1 sum="; a + b + c + d + e
end sub

' --- set: 5 unrolled writes to a render-owned field ----------------------------------------------
sub doSet()
    m.global.probeSink = 101                            ' PROBE-LINE set-1
    m.global.probeSink = 102                            ' PROBE-LINE set-2
    m.global.probeSink = 103                            ' PROBE-LINE set-3
    m.global.probeSink = 104                            ' PROBE-LINE set-4
    m.global.probeSink = 105                            ' PROBE-LINE set-5
    print "### PHASE set END expected=5+1"
end sub

' --- call: 5 unrolled callFunc invocations on a render-owned node --------------------------------
sub doCall()
    a = m.probeNode.callFunc("probeAdd", 201)           ' PROBE-LINE call-1
    b = m.probeNode.callFunc("probeAdd", 202)           ' PROBE-LINE call-2
    c = m.probeNode.callFunc("probeAdd", 203)           ' PROBE-LINE call-3
    d = m.probeNode.callFunc("probeAdd", 204)           ' PROBE-LINE call-4
    e = m.probeNode.callFunc("probeAdd", 205)           ' PROBE-LINE call-5
    print "### PHASE call END expected=5+1 sum="; a + b + c + d + e
end sub

' --- local (control): 200 ops on a node this thread created. Must produce NO events. -------------
sub doLocal()
    local = CreateObject("roSGNode", "Node")
    local.addFields({ localSink: 0 })
    total = 0
    for i = 1 to 100
        local.localSink = i
        total = total + local.localSink
    end for
    print "### PHASE local END expected=0+1 total="; total
end sub

' --- slow: 16 reads spaced 250 ms apart, spanning the render thread's ~2000 ms busy-spin ---------
' Spaced rather than single, so the measurement does not depend on winning a race: the spin starts
' 500 ms in and lasts 2000 ms, so several reads land inside it and report a long duration while the
' rest report a short one. The spread is what pins the units and the base of start-tm/end-tm.
sub doSlow()
    print "### PHASE slow issuing 16 reads at 250ms spacing across the render busy-spin"
    v = 0
    for i = 1 to 16
        sleep(250)
        v = m.global.probeCounter                       ' PROBE-LINE slow-loop
    end for
    print "### PHASE slow END expected=16+1 value="; v
end sub

' --- flood: 1500 reads from a single line, to overrun the documented 1000-event queue ------------
sub doFlood()
    total = 0
    for i = 1 to 1500
        total = total + m.global.probeCounter           ' PROBE-LINE flood-loop
    end for
    print "### PHASE flood END expected=1500+1 total="; total
end sub
