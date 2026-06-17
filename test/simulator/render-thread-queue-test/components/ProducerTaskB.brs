sub init()
    m.top.functionName = "produce"
end sub

sub produce()
    queue = CreateObject("roRenderThreadQueue")

    queue.PostMessage("status", { from: "B", state: "started" })

    for i = 1 to 6
        if i mod 2 = 0
            ' PostMessage of a roSGNode must copy it (a node can't be exclusively moved across
            ' threads), so each of these increments NumCopies.
            node = CreateObject("roSGNode", "ContentNode")
            node.title = "payload " + i.ToStr()
            node.addField("seq", "integer", false)
            node.seq = i
            queue.PostMessage("b.node", node)
        else
            ' CopyMessage always copies, but is NOT counted by NumCopies (which tracks PostMessage).
            queue.CopyMessage("b.tick", { seq: i, from: "B", note: "tick " + i.ToStr() })
        end if
        sleep(800)
    end for

    ' Three PostMessage(node) calls => NumCopies should be 3 (the CopyMessage calls don't count).
    queue.PostMessage("status", { from: "B", state: "done", copies: queue.NumCopies() })
end sub
