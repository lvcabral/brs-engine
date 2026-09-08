' Task-thread side of the callFunc/Task-thread probe.
'
' Verifies the assumptions behind brs-engine's render->Task callFunc rendezvous fix (see
' .claude/docs/threading-and-rendezvous.md):
'   - callFunc issued by the render thread actually runs ON this task's own thread, not locally
'     against a stale render-side reconstruction. This is NOT provable by basic-init succeeding
'     alone: a Task's init() runs synchronously on render too, at construction time, so a buggy
'     engine that never rendezvouses at all and just falls back to running callFunc locally,
'     against render's OWN copy of this node, would *also* find m.initNode there (it was render's
'     own init() that created it) and "succeed" by accident, against the wrong node entirely.
'
'     The readback proof must use a RAW PRIMITIVE (m.rawInitMirror), NOT a Node field
'     (m.initNode.value) -- an earlier version of this probe used the Node field and produced a
'     false MATCH against the known-buggy engine (confirmed by instrumenting the engine directly:
'     the callFunc genuinely ran locally on render's own m.initNode, never touching the task's
'     thread at all). The false MATCH happened because a Node *reference* that has been part of a
'     Task's initial cross-thread `m` seed can resolve through a live address-based proxy back to
'     the render-owned original -- so a plain "does the task's own read see the mutation" check
'     over a Node field can pass by rendezvousing on the READ, independent of whether the callFunc
'     itself ever rendezvoused. A raw primitive has no such proxy: a script-scope `m` primitive
'     never crosses threads by any path (that lack of cross-thread visibility for raw `m` members
'     is the exact root cause of the original crash this fix addresses), so the ONLY way the task's
'     own read of m.rawInitMirror can see render's write is if the callFunc call that set it
'     actually executed on the task's own thread, against the task's own real `m`. m.top.checkInitNode
'     asks THIS TASK's OWN code (not another callFunc, not render) to read m.rawInitMirror back and
'     report it. Only a genuine rendezvous, executing the callFunc against the task's real thread,
'     makes the task's own readback agree with what the callFunc call just set.
'   - whether a script-scope `m` value's visibility from a callFunc-invoked function depends on
'     WHEN it was created: in init() (PHASE basic-init) vs. after activation, inside runTask()
'     itself (PHASE basic-post) -- this distinction is the exact condition that used to crash
'     brs-engine (a New Relic SDK Task calling m.nrHarvestTimerEvents.duration = x from a callFunc
'     issued by the main thread). A first device run showed PHASE basic-post crashing with `m`
'     missing every key runTask() added after init() returned (postLaunchNode/spinCounter/
'     spinRunning gone entirely; only global/port/top survived, and port itself came back
'     `invalid`, presumably because a live roMessagePort can't cross whatever boundary this is) --
'     basic-init exists to confirm whether init()-time state is exactly the boundary.
'   - whether a callFunc-visible node reference is genuinely LIVE/shared with the task's own copy,
'     or a disconnected reconstruction: PHASE refresh has the task mutate m.initNode ITSELF (not
'     via callFunc) and then reports whether a callFunc'd read sees that mutation.
'   - whether a DECLARED field (m.top.xxx, synced via the already-proven-working field-sync path)
'     set after init() is visible via callFunc regardless of timing, unlike a raw m member (PHASE
'     latefield) -- if so, the init()-boundary restriction is specific to raw script-scope `m`,
'     not to "state added after activation" in general.
'   - a nested, reverse-direction access to render-owned data (m.global) works *during* a call the
'     render thread is blocked waiting on, without deadlocking (PHASE nested).
'   - callFunc on a task that is mid-way through a tight, non-yielding loop (PHASE busy).
'   - a render-side observer of this task's OWN field calling back into this task before that
'     field-set's own acknowledgment has been sent (PHASE selfdeadlock) -- brs-engine's own
'     render-side wait loop deadlocks here. That is a fixture-design hazard, not something the
'     shipped fix needs to handle: the real crash always calls callFunc from the main loop's own
'     context, never from a field observer of the target task. This phase finds out whether a real
'     device deadlocks too, or resolves it safely -- see the README before running it.

sub init()
    m.top.functionName = "runTask"
    ' Registered here (render thread, before launch) so wait()'s port keeps servicing this thread
    ' while runTask() loops -- see .claude/docs/threading-and-rendezvous.md.
    m.port = CreateObject("roMessagePort")
    m.top.observeField("control", m.port)
    m.top.observeField("trigger", m.port)
    m.top.observeField("startSpin", m.port)
    m.top.observeField("bumpInitNode", m.port)
    m.top.observeField("checkInitNode", m.port)

    ' Created HERE, before activation -- the comparison point for PHASE basic-post's node, which
    ' is created after activation instead (in runTask()). See PHASE basic-init/basic-post below.
    m.initNode = CreateObject("roSGNode", "Node")
    m.initNode.addField("value", "integer", false)
    m.initNode.value = 0
    ' Raw-primitive mirror of m.initNode.value, updated alongside it by touchInitNode -- see the
    ' header comment above for why the readback proof (checkInitNode, below) must use this instead
    ' of m.initNode.value.
    m.rawInitMirror = 0

    ' Also created here (not in runBusySpin()/runTask()) so PHASE busy's callFunc'd read stays
    ' meaningful post-fix: a *raw* `m` member holding a primitive is captured into callFuncM by
    ' value at snapshot time and never updates again, even if the member itself existed at
    ' snapshot time -- only a Node's OWN field mutations (not reassigning the `m` key) stay live.
    ' Using a small Node here, mutated via setValue in runBusySpin() rather than by reassigning
    ' m.spinCounter/m.spinRunning directly, keeps the reads live for the same reason m.initNode's
    ' `value` field does.
    m.spinState = CreateObject("roSGNode", "Node")
    m.spinState.addField("counter", "integer", false)
    m.spinState.addField("running", "boolean", false)
end sub

sub runTask()
    ' Created AFTER activation, on this thread -- the exact condition that used to crash a
    ' render-initiated callFunc in brs-engine (a script-scope node reference that never
    ' independently crossed to the render thread before).
    m.postLaunchNode = CreateObject("roSGNode", "Node")
    m.postLaunchNode.addField("value", "integer", false)
    m.postLaunchNode.value = 0
    ' A DECLARED field set after init(), same timing as postLaunchNode above but going through the
    ' field-sync path (m.top.xxx) instead of a raw m member -- comparison point for PHASE latefield.
    m.top.lateValue = 100
    m.top.ready = true

    print "### TASK ready"
    while true
        msg = wait(0, m.port)
        if type(msg) = "roSGNodeEvent"
            field = msg.getField()
            if field = "trigger" and msg.getData()
                ' A task-owned field write, observed by the render thread's onPulse -- the setup
                ' for PHASE selfdeadlock.
                m.top.pulse = m.top.pulse + 1
            else if field = "startSpin" and msg.getData()
                runBusySpin(3000)
            else if field = "bumpInitNode" and msg.getData()
                ' The task mutating m.initNode ITSELF (not via callFunc) -- PHASE refresh checks
                ' whether a later callFunc'd read reflects this, i.e. whether the reference a
                ' callFunc dispatch resolves is genuinely live/shared, not a one-time disconnected
                ' reconstruction.
                before = m.initNode.value
                m.initNode.value = m.initNode.value + 1000
                print "### TASK bumpInitNode before="; before; " after="; m.initNode.value
            else if field = "checkInitNode" and msg.getData()
                ' The definitive rendezvous proof: reads m.rawInitMirror (a raw primitive, immune
                ' to the Node cross-thread proxy that made an earlier version of this check pass
                ' even against the known-buggy engine -- see the header comment) from THIS task's
                ' own code (not a callFunc, not render) and reports it back. A callFunc that
                ' actually ran on this thread, against this thread's real `m`, made a mutation THIS
                ' read will see. A callFunc that silently ran locally on render's own disconnected
                ' copy of this node (the original bug) never touched this thread's `m` at all --
                ' this read would report whatever this thread's own code last set, not render's call.
                print "### TASK checkInitNode reports m.rawInitMirror="; m.rawInitMirror; " m.initNode.value="; m.initNode.value
                m.top.taskSideInitValue = m.rawInitMirror
                m.top.taskSideNodeValue = m.initNode.value
            end if
        end if
    end while
end sub

' --- PHASE basic-init: touch the init()-time node from a callFunc issued by the render thread's
' own top-level loop. Comparison point for PHASE basic-post below. --------------------------------
function touchInitNode(addend as integer) as integer
    print "### TASK touchInitNode ENTER m-keys="; m.keys().join(",")
    m.initNode.value = m.initNode.value + addend
    m.rawInitMirror = m.initNode.value
    print "### TASK touchInitNode addend="; addend; " value now="; m.initNode.value
    return m.initNode.value
end function

' --- PHASE basic-post: touch the post-launch node from a callFunc issued by the render thread's
' own top-level loop (matches the reported crash's call shape). -----------------------------------
function touchPostLaunchNode(addend as integer) as integer
    print "### TASK touchPostLaunchNode ENTER m-keys="; m.keys().join(",")
    m.postLaunchNode.value = m.postLaunchNode.value + addend
    print "### TASK touchPostLaunchNode addend="; addend; " value now="; m.postLaunchNode.value
    return m.postLaunchNode.value
end function

' --- PHASE latefield: touch a DECLARED field (m.top.lateValue) that was set after init(), the same
' timing as m.postLaunchNode but through the field-sync path instead of a raw m member. -----------
function touchLateField(addend as integer) as integer
    print "### TASK touchLateField ENTER m-keys="; m.keys().join(",") ; " lateValue="; m.top.lateValue
    m.top.lateValue = m.top.lateValue + addend
    print "### TASK touchLateField addend="; addend; " value now="; m.top.lateValue
    return m.top.lateValue
end function

' --- PHASE nested: read m.global (render-owned) *during* a call the render thread is blocked
' waiting on. If this deadlocks/times out, the render thread never sees the "END" print at all. ---
function readGlobalDuringCall(tag as string) as string
    span = CreateObject("roTimespan")
    span.mark()
    value = m.global.probeValue ' nested rendezvous back into render, mid-callFunc
    elapsed = span.totalMilliseconds()
    print "### TASK readGlobalDuringCall tag="; tag; " m.global.probeValue="; value; " nested-read-ms="; elapsed
    return tag + ":" + value + ":" + elapsed.toStr() + "ms"
end function

' --- PHASE types: round-trips several BrightScript types through the callFunc return value. -------
function returnTypesCheck(which as string) as dynamic
    print "### TASK returnTypesCheck which="; which
    if which = "int" then return 12345
    if which = "str" then return "hello-from-task"
    if which = "bool" then return true
    if which = "invalid" then return invalid
    if which = "aa"
        return { a: 1, b: "two", c: [3, 4, 5] }
    end if
    if which = "node"
        n = CreateObject("roSGNode", "Node")
        n.addField("marker", "string", false)
        n.marker = "node-from-task"
        return n
    end if
    return "unknown:" + which
end function

' --- PHASE busy: called while this task is executing a tight, non-yielding loop (no wait()). Does
' the render thread's callFunc block until the loop ends and this thread reaches wait() again, or
' can the runtime service it earlier, mid-statement? m.spinState's fields (mutated via setValue in
' runBusySpin(), not by reassigning an m member -- see the init() comment) let the render thread
' see how far along the spin was when this actually got serviced. ----------------------------------
function duringSpin(tag as string) as string
    print "### TASK duringSpin CALLED tag="; tag; " spinCounter="; m.spinState.counter; " spinRunning="; m.spinState.running
    return tag + ":spinCounter=" + m.spinState.counter.toStr() + ":spinRunning=" + m.spinState.running.toStr()
end function

sub runBusySpin(ms as integer)
    m.spinState.running = true
    m.spinState.counter = 0
    span = CreateObject("roTimespan")
    span.mark()
    while span.totalMilliseconds() < ms
        m.spinState.counter = m.spinState.counter + 1
    end while
    m.spinState.running = false
    print "### TASK runBusySpin END spinCounter="; m.spinState.counter
end sub

' --- PHASE selfdeadlock: the render thread calls this back into this SAME task from inside the
' observer of "pulse" (this task's own field), synchronously, before the render thread has finished
' processing the field-set that fired that observer (and so before this task's pending ack for it
' has been sent). See the README before running this phase. ----------------------------------------
function respondToPulse(tag as string) as string
    print "### TASK respondToPulse tag="; tag; " pulse="; m.top.pulse
    return tag + ":pulse=" + m.top.pulse.toStr()
end function
