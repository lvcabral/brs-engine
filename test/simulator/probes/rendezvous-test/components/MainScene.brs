sub init()
    m.lines = []
    buildGlobalState()

    m.task = CreateObject("roSGNode", "RendezvousTask")
    m.task.observeField("ready", "onTaskReady")
    m.task.control = "RUN"

    ' Backstop: report whatever arrived if the task never finishes.
    m.timeout = CreateObject("roSGNode", "Timer")
    m.timeout.duration = 20
    m.timeout.observeField("fire", "onTimeout")
    m.timeout.control = "start"
end sub

sub buildGlobalState()
    config = CreateObject("roSGNode", "Node")
    config.id = "ConfigNode"
    ' Added at runtime: a bare node reference cannot carry these, they must be fetched.
    config.addFields({ apiKey: "key-v1", region: "us-east" })

    manager = CreateObject("roSGNode", "Node")
    manager.id = "ContentManager"
    for i = 0 to 9
        item = CreateObject("roSGNode", "ContentNode")
        item.id = "Item" + str(i).Trim()
        item.title = "entry " + str(i).Trim()
        manager.appendChild(item)
    end for

    m.probe = CreateObject("roSGNode", "ProbeComp")

    m.global.addFields({
        appName: "rendezvous-test"
        launchCount: 1
        configNode: config
        manager: manager
        probe: m.probe
        settings: { theme: "dark", locale: "en-US" }
        tags: ["alpha", "beta", "gamma"]
    })
end sub

sub onTaskReady()
    if m.task.ready = 1
        add("========== PHASE 1: task reads global state ==========")
        addReport(m.task.report1)

        add("")
        add("========== render-side effects of the task's writes ==========")
        ' Did the task's writes reach the render thread's authoritative copy?
        report("R30 configNode.region (task wrote)", m.global.configNode.region)
        report("R31 m.global.launchCount (task wrote)", m.global.launchCount)
        ' The task called probe.report() once; if that rendezvoused, the render-side
        ' m.callCount is now 1 and this call returns 2.
        r = m.probe.callFunc("report", invalid)
        report("R32 probe callCount on render   ", r.callCount)
        add("    1 => the task ran callFunc on its own copy")
        add("    2 => the call rendezvoused to the render thread")

        ' Now mutate the same state and let the task look again.
        m.global.configNode.apiKey = "key-v2-rotated"
        m.global.configNode.addFields({ sessionId: "sess-abc" })
        newItem = CreateObject("roSGNode", "ContentNode")
        newItem.id = "Item10"
        newItem.title = "appended later"
        m.global.manager.appendChild(newItem)
        m.global.appName = "renamed-after-launch"

        m.task.phase = 2
    else if m.task.ready = 2
        add("")
        add("========== PHASE 2: task re-reads after render-side edits ==========")
        addReport(m.task.report2)
        add("    stale values here => the task holds a snapshot")
        add("    updated values    => the task sees live global state")
        finish()
    end if
end sub

sub onTimeout()
    add("")
    add("!! TIMED OUT — task did not complete both phases")
    finish()
end sub

sub addReport(text as String)
    if text = invalid or text = ""
        add("(no report)")
        return
    end if
    for each line in text.Split(chr(10))
        if line <> "" then add(line)
    end for
end sub

' Records a labelled value on screen and in the console, like the task-side emit().
sub report(id as String, value as Dynamic)
    add(id + " = " + fmt(value))
end sub

sub add(line as String)
    m.lines.push(line)
    ? "[RDV] " + line
end sub

sub finish()
    m.timeout.control = "stop"
    m.top.findNode("Results").text = joinLines(m.lines)
end sub
