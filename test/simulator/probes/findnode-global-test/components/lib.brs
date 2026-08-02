' Shared helper, included explicitly by every component so the app behaves identically
' whether or not the runtime puts pkg:/source in the global scope.

' Renders a findNode result as a short, unambiguous string.
function describeNode(node as Dynamic) as String
    if node = invalid then return "invalid"
    if type(node) <> "roSGNode" then return "NOT-A-NODE(" + type(node) + ")"

    nodeId = node.id
    if nodeId = invalid or nodeId = "" then nodeId = "<no-id>"
    return node.subtype() + "#" + nodeId
end function
