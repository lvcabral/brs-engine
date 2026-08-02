sub init()
    m.lines = []

    ' A node created and owned by the render thread, handed to the task.
    m.probeRender = CreateObject("roSGNode", "Probe")
    m.probeRender.callFunc("setOrigin", { origin: "render", token: "R1" })

    m.task = CreateObject("roSGNode", "ProbeTask")
    m.task.probeIn = m.probeRender
    m.task.observeField("report", "onTaskReport")
    m.task.control = "RUN"
end sub

sub onTaskReport()
    add("========== Q4: task calling callFunc on a RENDER-owned node ==========")
    add("what the task saw:")
    for each line in m.task.report.Split(chr(10))
        if line <> "" then add(line)
    end for

    ' The render thread's own copy of m.callCount is 0 until this call. If the task's call
    ' rendezvoused here, this call returns 2; if the task ran against its own copy, it returns 1.
    r4 = m.probeRender.callFunc("report", invalid)
    add("render-side callCount now = " + fmt(r4.callCount))
    add("  1 => the task ran callFunc against its OWN copy of m")
    add("  2 => the call rendezvoused to the render thread (one shared m)")
    add("")

    add("========== Q1: does a task-created node's m reach the render thread? ==========")
    probeOut = m.task.probeOut
    if probeOut = invalid
        add("probeOut = invalid  (node did not cross)")
        renderResults()
        return
    end if

    r1 = probeOut.callFunc("report", invalid)
    if r1 = invalid
        add("callFunc returned invalid")
        renderResults()
        return
    end if
    add("m.createdIn = " + fmt(r1.createdIn) + "   (task => m travelled; unset => init() re-ran here)")
    add("m.token     = " + fmt(r1.token) + "   (expect 'T1')")
    add("")

    add("========== Q2: is a NODE stored in m live, or a snapshot? ==========")
    add("m.stashed kind          = " + fmt(r1.stashKind))
    add("m.stashed.title before  = " + fmt(r1.stashTitle) + "   (expect 'set-in-task')")

    shared = m.task.sharedOut
    if shared = invalid
        add("sharedOut = invalid — cannot test liveness")
        renderResults()
        return
    end if

    ' Mutate the referenced node through the separate handle, then re-read it through m.
    shared.title = "changed-on-render"
    r2 = probeOut.callFunc("report", invalid)
    add("m.stashed.title after   = " + fmt(r2.stashTitle))
    add("  'changed-on-render' => m holds a LIVE reference to the same node")
    add("  'set-in-task'       => m holds a detached SNAPSHOT copy")

    renderResults()
end sub

sub add(line as String)
    m.lines.push(line)
    ? "[XTHREAD] " + line
end sub

sub renderResults()
    m.top.findNode("Results").text = joinLines(m.lines)
end sub
