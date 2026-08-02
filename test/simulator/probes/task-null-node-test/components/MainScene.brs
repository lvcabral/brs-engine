sub init()
    m.task = CreateObject("roSGNode", "ClearingTask")
    m.task.observeField("payload", "onPayload")
    m.task.observeField("done", "onDone")
    m.task.control = "RUN"
end sub

sub onPayload()
    p = m.task.payload
    if p = invalid
        ? "[NULLNODE] payload observed = invalid  (cleared by the task)"
    else
        ? "[NULLNODE] payload observed = " + p.subtype() + "#" + p.id
    end if
end sub

sub onDone()
    ? "[NULLNODE] task finished, render thread still alive"
    p = m.task.payload
    if p = invalid
        ? "[NULLNODE] final payload = invalid"
    else
        ? "[NULLNODE] final payload = " + p.subtype() + "#" + p.id
    end if
end sub
