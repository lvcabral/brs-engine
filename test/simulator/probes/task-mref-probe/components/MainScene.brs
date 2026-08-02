sub init()
    ' Give the global node a field, so Case A has something to read back through.
    m.global.addFields({ probeMarker: "global-marker" })

    m.task = CreateObject("roSGNode", "ProbeTask")
    m.task.observeField("report", "onReport")
    m.task.control = "RUN"
end sub

sub onReport()
    lines = []
    lines.push("========== Task m-ref Probe ==========")
    for each line in m.task.report.Split(chr(10))
        if line <> "" then lines.push(line)
    end for
    lines.push("")
    lines.push("---------- render side, after the task finished ----------")
    lines.push("m.task.payloadNode.title = " + fieldOf(m.task.payloadNode, "title"))
    lines.push("  'changed-in-task'   => the task's write reached the render thread's node")
    lines.push("  'payload-from-init' => the task mutated a copy the render thread never sees")
    lines.push("========== end ==========")

    for each line in lines
        ? "[MREF] " + line
    end for
    m.top.findNode("Results").text = joinLines(lines)
end sub
