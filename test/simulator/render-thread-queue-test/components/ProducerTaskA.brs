sub init()
    m.top.functionName = "produce"
end sub

sub produce()
    ' Created on the Task thread: this is the task thread's own queue singleton. PostMessage
    ' routes to the render thread's queue (which holds the handlers) by channel id.
    queue = CreateObject("roRenderThreadQueue")

    queue.PostMessage("status", { from: "A", state: "started" })

    for i = 1 to 6
        queue.PostMessage("a.tick", { seq: i, from: "A", note: "tick " + i.ToStr() })
        sleep(600)
    end for

    ' Task A only moves AA payloads, so NumCopies should be 0.
    queue.PostMessage("status", { from: "A", state: "done", copies: queue.NumCopies() })
end sub
