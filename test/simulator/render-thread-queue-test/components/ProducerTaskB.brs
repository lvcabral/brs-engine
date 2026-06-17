sub init()
    m.top.functionName = "produce"
end sub

sub produce()
    queue = CreateObject("roRenderThreadQueue")

    queue.PostMessage("status", { from: "B", state: "started" })

    for i = 1 to 6
        if i mod 2 = 0
            ' CopyMessage copies the node (counted by NumCopies). roSGNode is recursively
            ' copyable, so it survives the cross-thread hop.
            node = CreateObject("roSGNode", "ContentNode")
            node.title = "payload " + i.ToStr()
            node.addField("seq", "integer", false)
            node.seq = i
            queue.CopyMessage("b.node", node)
        else
            queue.PostMessage("b.tick", { seq: i, from: "B", note: "tick " + i.ToStr() })
        end if
        sleep(800)
    end for

    ' Three CopyMessage(node) calls => NumCopies should be 3.
    queue.PostMessage("status", { from: "B", state: "done", copies: queue.NumCopies() })
end sub
