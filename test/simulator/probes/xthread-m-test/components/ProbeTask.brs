sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    lines = []

    ' Q4: call report() on a node created and owned by the RENDER thread. If the call
    ' rendezvouses to the owner, it runs against the render thread's `m` and bumps the render
    ' thread's callCount; if it runs locally against a copy, the render side never sees it.
    probeIn = m.top.probeIn
    if probeIn <> invalid
        r = probeIn.callFunc("report", invalid)
        if r <> invalid
            lines.push("  m.createdIn = " + fmt(r.createdIn) + "   (expect 'render')")
            lines.push("  m.token     = " + fmt(r.token) + "   (expect 'R1')")
            lines.push("  callCount   = " + fmt(r.callCount))
        else
            lines.push("  callFunc returned invalid")
        end if
    else
        lines.push("  probeIn = invalid")
    end if

    ' Build a node ON THIS THREAD whose `m` holds state plus a node reference, then hand both
    ' the probe and the referenced node to the render thread.
    probeTask = CreateObject("roSGNode", "Probe")
    probeTask.callFunc("setOrigin", { origin: "task", token: "T1" })

    content = CreateObject("roSGNode", "ContentNode")
    content.id = "SharedContent"
    content.title = "set-in-task"
    probeTask.callFunc("stash", content)

    ' Order matters: the render thread reads these when `report` fires.
    m.top.sharedOut = content
    m.top.probeOut = probeTask
    m.top.report = joinLines(lines)
end sub
