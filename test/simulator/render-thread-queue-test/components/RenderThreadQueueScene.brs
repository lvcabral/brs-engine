sub init()
    m.top.backgroundColor = "0x0B0F14FF"

    ' Create the render-thread queue (this instance owns the handlers).
    m.queue = CreateObject("roRenderThreadQueue")

    ' AddMessageHandler can only be called on the render thread. Two handlers on the same
    ' "status" channel demonstrate fan-out: both fire, in registration order.
    m.queue.AddMessageHandler("status", "onStatus")
    m.queue.AddMessageHandler("status", "onStatusCount")
    m.queue.AddMessageHandler("a.tick", "onTaskATick")
    m.queue.AddMessageHandler("b.tick", "onTaskBTick")
    m.queue.AddMessageHandler("b.node", "onTaskBNode")

    m.logA = []
    m.logB = []
    m.countA = 0
    m.countB = 0
    m.statusCount = 0

    m.lblA = m.top.findNode("logA")
    m.lblB = m.top.findNode("logB")
    m.lblStatus = m.top.findNode("status")
    m.lblStats = m.top.findNode("stats")

    ' Each task creates its OWN roRenderThreadQueue (per-thread singleton) and posts to it;
    ' messages are routed back to the render-thread handlers by channel id.
    m.taskA = CreateObject("roSGNode", "ProducerTaskA")
    m.taskA.control = "RUN"

    m.taskB = CreateObject("roSGNode", "ProducerTaskB")
    m.taskB.control = "RUN"
end sub

' --- "status" channel: two handlers registered, both fire in order -------------------------

sub onStatus(data, msgInfo)
    line = "STATUS [" + msgInfo.id + "]  Task " + data.from + ": " + data.state
    if data.state = "done" then line = line + "   (NumCopies=" + data.copies.ToStr() + ")"
    m.lblStatus.text = line
end sub

sub onStatusCount(data, msgInfo)
    m.statusCount = m.statusCount + 1
    updateStats()
end sub

' --- Task A: moved roAssociativeArray payloads ---------------------------------------------

sub onTaskATick(data, msgInfo)
    m.countA = m.countA + 1
    appendLog(m.logA, "#" + data.seq.ToStr() + "  (move)  " + data.note)
    m.lblA.text = joinLines(m.logA)
    updateStats()
end sub

' --- Task B: alternates moved AA and copied roSGNode payloads ------------------------------

sub onTaskBTick(data, msgInfo)
    m.countB = m.countB + 1
    appendLog(m.logB, "#" + data.seq.ToStr() + "  (move)  " + data.note)
    m.lblB.text = joinLines(m.logB)
    updateStats()
end sub

sub onTaskBNode(data, msgInfo)
    m.countB = m.countB + 1
    title = "?"
    seq = "?"
    if type(data) = "roSGNode"
        title = data.title
        seq = data.seq.ToStr()
    end if
    appendLog(m.logB, "#" + seq + "  (copy node)  " + title)
    m.lblB.text = joinLines(m.logB)
    updateStats()
end sub

' --- helpers --------------------------------------------------------------------------------

sub appendLog(log as object, entry as string)
    log.push(entry)
    if log.Count() > 11 then log.Delete(0)
end sub

sub updateStats()
    total = m.countA + m.countB
    m.lblStats.text = "Messages received: " + total.ToStr() + "    (A=" + m.countA.ToStr() + ", B=" + m.countB.ToStr() + ")    status events=" + m.statusCount.ToStr()
end sub

function joinLines(lines as object) as string
    s = ""
    for each line in lines
        if s <> "" then s = s + Chr(10)
        s = s + line
    end for
    return s
end function
