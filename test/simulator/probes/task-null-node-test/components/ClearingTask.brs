sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    ' Hand a node to the render thread...
    node = CreateObject("roSGNode", "ContentNode")
    node.id = "Payload"
    node.title = "from task"
    m.top.payload = node

    ' ...then clear it. The render side still holds the node, so the incoming update carries
    ' a null value against a node-valued field — the shape that crashed.
    m.top.payload = invalid

    m.top.done = true
end sub
