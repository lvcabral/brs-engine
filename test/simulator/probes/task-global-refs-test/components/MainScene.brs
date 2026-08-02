sub init()
    ' A render-owned config node whose fields are added AT RUNTIME — the case a bare
    ' address reference cannot carry, so the task must rendezvous to read them.
    config = CreateObject("roSGNode", "Node")
    config.id = "ConfigNode"
    config.addFields({ apiKey: "abc123", region: "us-east" })

    ' A manager node with children, to prove the subtree is not shipped in the payload.
    manager = CreateObject("roSGNode", "Node")
    manager.id = "ContentManager"
    for i = 0 to 39
        item = CreateObject("roSGNode", "ContentNode")
        item.title = "entry " + str(i).Trim()
        manager.appendChild(item)
    end for

    m.global.addFields({ configNode: config, contentManager: manager })

    m.task = CreateObject("roSGNode", "ReaderTask")
    m.task.observeField("report", "onReport")
    m.task.control = "RUN"
end sub

sub onReport()
    for each line in m.task.report.Split(chr(10))
        if line <> "" then ? "[GLOBALREF] " + line
    end for
end sub
