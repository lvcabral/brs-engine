' Render-thread side of the probe. Maps remote keys to phases, calls callFunc on the Task from a
' clean, non-nested context in each (matching how the reported crash actually calls it), times each
' call, and drives a heartbeat counter so a stalled render thread is visible on screen.

sub init()
    m.top.backgroundURI = ""
    m.top.backgroundColor = "0x101020FF"

    ' Render-owned global value the task reads *during* a callFunc it is blocked on (PHASE nested).
    m.global.addFields({ probeValue: "render-owned-global-value" })

    m.keymap = m.top.findNode("keymap")
    m.status = m.top.findNode("status")
    m.heartbeat = m.top.findNode("heartbeat")
    m.heartbeatTimer = m.top.findNode("heartbeatTimer")
    m.spinCallTimer = m.top.findNode("spinCallTimer")
    m.refreshCallTimer = m.top.findNode("refreshCallTimer")

    m.beatCount = 0
    m.armed = false
    m.taskReady = false

    m.heartbeatTimer.observeField("fire", "onHeartbeat")
    m.heartbeatTimer.control = "start"
    m.spinCallTimer.observeField("fire", "onSpinCallTimer")
    m.refreshCallTimer.observeField("fire", "onRefreshCallTimer")

    m.keymap.text = [
        "CALLFUNC / TASK-THREAD PROBE"
        ""
        "REWIND    basic-init    callFunc touches an init()-time task node"
        "UP        basic-post    callFunc touches a post-launch task node"
        "DOWN      nested        callFunc reads m.global mid-call (no deadlock?)"
        "LEFT      types         callFunc return-value round trip, several types"
        "RIGHT     busy          callFunc while the task spins without wait()"
        "FFWD      refresh       task bumps its own initNode, then callFunc reads it"
        "REPLAY    latefield     callFunc touches a field set after init() (m.top.xxx)"
        "OPTIONS   arm           arms the self-deadlock phase (see README first!)"
        "OK        selfdeadlock  fires it (task->render->task nested callFunc)"
        "BACK                    exit"
        ""
        "Watch the heartbeat counter below -- it stalls whenever the render"
        "thread is blocked waiting on a callFunc to return."
    ].join(chr(10))

    m.task = CreateObject("roSGNode", "ProbeTask")
    m.task.observeField("ready", "onTaskReady")
    m.task.observeField("pulse", "onPulse")
    m.task.observeField("taskSideInitValue", "onTaskSideInitValue")
    m.task.observeField("taskSideNodeValue", "onTaskSideNodeValue")
    m.task.control = "run"

    m.top.setFocus(true)
end sub

sub onHeartbeat(event as object)
    m.beatCount = m.beatCount + 1
    m.heartbeat.text = "heartbeat: " + m.beatCount.toStr()
    m.heartbeatTimer.control = "start"
end sub

sub onTaskReady(event as object)
    if event.getData()
        m.taskReady = true
        print "### RENDER task ready"
        m.status.text = "task ready -- press a phase key"
    end if
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    ' Every phase below assumes the Task has already created m.postLaunchNode and reached its own
    ' wait() loop -- a callFunc that lands before then would just find an incomplete `m`, which is
    ' a race in this probe's own startup timing, not something the questions above are about.
    if not m.taskReady and key <> "back"
        print "### RENDER task not ready yet -- wait for '### RENDER task ready' before pressing phase keys"
        return true
    end if

    if key = "rewind"
        runBasicInit()
    else if key = "up"
        runBasicPost()
    else if key = "down"
        runNested()
    else if key = "left"
        runTypes()
    else if key = "right"
        print "### PHASE busy BEGIN: starting a 3s non-yielding task spin, calling in 500ms"
        m.status.text = "busy: starting 3s task spin, calling in 500ms..."
        m.task.startSpin = true
        m.spinCallTimer.control = "start"
    else if key = "fastforward"
        print "### PHASE refresh BEGIN: task will bump its own initNode by 1000, calling in 300ms"
        m.status.text = "refresh: bumping task-side initNode, calling in 300ms..."
        m.task.bumpInitNode = true
        m.refreshCallTimer.control = "start"
    else if key = "replay"
        runLateField()
    else if key = "options"
        m.armed = true
        print "### RENDER selfdeadlock ARMED -- press OK to fire. Risk of app freeze -- see README."
        m.status.text = "selfdeadlock ARMED -- press OK to fire (may freeze the app, see README)"
    else if key = "OK"
        if m.armed
            m.armed = false
            print "### PHASE selfdeadlock BEGIN: setting m.task.trigger"
            m.status.text = "selfdeadlock firing..."
            m.task.trigger = true
        else
            print "### RENDER press OPTIONS first to arm the self-deadlock phase"
        end if
    else
        return false
    end if

    return true
end function

' --- PHASE basic-init --------------------------------------------------------------------------
' The callFunc succeeding is NOT proof it ran on the task's own thread against the task's own real
' node -- see the header comment in ProbeTask.brs for the full story (an earlier version of this
' probe used a Node-field readback as "proof" and it produced a false MATCH against the
' known-buggy engine, discovered by instrumenting the engine directly). The trustworthy,
' BrightScript-observable signal that survived that investigation is TIMING: a callFunc that
' silently ran locally on render (the original bug) returns near-instantly, because no thread
' boundary was ever actually crossed; a callFunc that genuinely rendezvouses to the task's own
' thread cannot return before that round trip completes. Verified directly against both a
' known-buggy build and the fixed build: consistently ~0ms local vs. several hundred ms genuine
' round trip. The two readback fields below (taskSideInitValue/taskSideNodeValue) are kept as
' documented diagnostics, NOT as the pass/fail signal -- see their handlers for why each one is
' unreliable on its own.
sub runBasicInit()
    print "### PHASE basic-init BEGIN"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("touchInitNode", 42)
    elapsed = span.totalMilliseconds()
    verdict = "SUSPICIOUS -- near-instant return; callFunc likely ran locally on render, never reaching the task's own thread"
    if elapsed >= 20 then verdict = "genuine cross-thread round trip occurred"
    print "### PHASE basic-init END result="; result; " elapsed-ms="; elapsed; " -> "; verdict
    m.status.text = "basic-init: result=" + result.toStr() + " elapsed=" + elapsed.toStr() + "ms (" + verdict + ")"

    m.expectedInitValue = result
    print "### PHASE basic-init requesting task-side readback (diagnostics, not the verdict -- see comments)"
    m.task.checkInitNode = true
end sub

' DIAGNOSTIC, NOT the verdict: reports the task's own read of m.rawInitMirror (a raw `m` primitive,
' set by touchInitNode alongside its Node-field mutation). Per real-device testing done earlier for
' this fix, a raw script-scope primitive touched from inside a callFunc'd function is captured BY
' VALUE into a snapshot of the task's `m` and never propagates back to the task's own regular `m` --
' this is the SAME lack of cross-thread visibility for raw `m` members that caused the original
' crash this fix addresses, and it is device-accurate, so expect MISMATCH here even against a
' correctly fixed engine. It is included to document that nuance, not as a pass/fail check.
sub onTaskSideInitValue(event as object)
    taskSide = event.getData()
    print "### DIAGNOSTIC m.rawInitMirror task-side readback="; taskSide; " expected="; m.expectedInitValue; " (MISMATCH here is expected even when callFunc genuinely rendezvoused -- see comment above)"
end sub

' DIAGNOSTIC, NOT the verdict: reports the task's own read of m.initNode.value (a Node field). This
' one is UNRELIABLE as a rendezvous proof: instrumenting the engine directly showed the task's own
' "m.initNode" key resolves through a live, address-based cross-thread proxy back to render's own
' copy of the node -- a separate, pre-existing mechanism unrelated to this callFunc fix (it exists
' even in the known-buggy build). That proxy makes this readback agree with render's local mutation
' regardless of whether callFunc itself ever rendezvoused, so a MATCH here proves nothing either way.
sub onTaskSideNodeValue(event as object)
    taskSide = event.getData()
    print "### DIAGNOSTIC m.initNode.value task-side readback="; taskSide; " expected="; m.expectedInitValue; " (not a reliable signal -- see comment above)"
end sub

' --- PHASE basic-post ----------------------------------------------------------------------------
sub runBasicPost()
    print "### PHASE basic-post BEGIN"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("touchPostLaunchNode", 42)
    elapsed = span.totalMilliseconds()
    print "### PHASE basic-post END result="; result; " elapsed-ms="; elapsed
    m.status.text = "basic-post: result=" + result.toStr() + " elapsed=" + elapsed.toStr() + "ms"
end sub

' --- PHASE refresh (deferred call) --------------------------------------------------------------
' Checks whether the node reference a callFunc dispatch resolves is genuinely live/shared with the
' task's own copy: the task just mutated m.initNode ITSELF (bumpInitNode, above), so if this read
' does NOT reflect that +1000 bump, the callFunc-visible reference is a disconnected reconstruction
' rather than the same live object.
sub onRefreshCallTimer(event as object)
    print "### PHASE refresh calling touchInitNode after the task's own bump"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("touchInitNode", 1)
    elapsed = span.totalMilliseconds()
    print "### PHASE refresh END result="; result; " elapsed-ms="; elapsed
    m.status.text = "refresh: result=" + result.toStr() + " elapsed=" + elapsed.toStr() + "ms"
end sub

' --- PHASE latefield -----------------------------------------------------------------------------
sub runLateField()
    print "### PHASE latefield BEGIN"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("touchLateField", 7)
    elapsed = span.totalMilliseconds()
    print "### PHASE latefield END result="; result; " elapsed-ms="; elapsed
    m.status.text = "latefield: result=" + result.toStr() + " elapsed=" + elapsed.toStr() + "ms"
end sub

' --- PHASE nested ------------------------------------------------------------------------------
sub runNested()
    print "### PHASE nested BEGIN"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("readGlobalDuringCall", "probe1")
    elapsed = span.totalMilliseconds()
    print "### PHASE nested END result="; result; " elapsed-ms="; elapsed
    m.status.text = "nested: result=" + result + " elapsed=" + elapsed.toStr() + "ms"
end sub

' --- PHASE types -------------------------------------------------------------------------------
sub runTypes()
    print "### PHASE types BEGIN"
    kinds = ["int", "str", "bool", "invalid", "aa", "node"]
    for each kind in kinds
        result = m.task.callFunc("returnTypesCheck", kind)
        print "### PHASE types kind="; kind; " type="; type(result); " value="; result
    end for
    print "### PHASE types END"
    m.status.text = "types: see console for per-kind results"
end sub

' --- PHASE busy (deferred call) -----------------------------------------------------------------
sub onSpinCallTimer(event as object)
    print "### PHASE busy calling duringSpin while the task should still be spinning"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("duringSpin", "probe")
    elapsed = span.totalMilliseconds()
    print "### PHASE busy END result="; result; " elapsed-ms="; elapsed
    m.status.text = "busy: result=" + result + " elapsed=" + elapsed.toStr() + "ms"
end sub

' --- PHASE selfdeadlock --------------------------------------------------------------------------
' Fires synchronously from inside the observer of the task's OWN field ("pulse"), i.e. while the
' render thread is still inside the code path that applies that field's set and is not yet free to
' send its acknowledgment back to the task. See the README before running this phase.
sub onPulse(event as object)
    print "### RENDER onPulse pulse="; event.getData()
    print "### PHASE selfdeadlock calling back into the task NOW (deadlock risk)"
    span = CreateObject("roTimespan")
    span.mark()
    result = m.task.callFunc("respondToPulse", "fromPulse")
    elapsed = span.totalMilliseconds()
    print "### PHASE selfdeadlock END result="; result; " elapsed-ms="; elapsed
    m.status.text = "selfdeadlock: result=" + result + " elapsed=" + elapsed.toStr() + "ms"
end sub
