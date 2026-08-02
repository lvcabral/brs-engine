' Shared helpers. Loaded by both MainScene and ProbeTask so the two threads format
' their findings identically and the logs can be diffed line-for-line.

' Renders any value as a short, stable, printable token.
function describe(v as Dynamic) as String
    if v = invalid then return "invalid"
    kind = type(v)
    if kind = "roSGNode"
        id = v.id
        if id = "" then id = "(no id)"
        return v.subtype() + "#" + id
    end if
    if kind = "roAssociativeArray" then return "roAssociativeArray"
    if kind = "roArray" then return "roArray"
    if kind = "String" or kind = "roString" then return "'" + v + "'"
    return kind + ":" + str(v).Trim()
end function

' "same" / "different" / "n/a" — node identity as the device reports it.
function sameNode(a as Dynamic, b as Dynamic) as String
    if a = invalid or b = invalid then return "n/a (one side invalid)"
    if type(a) <> "roSGNode" or type(b) <> "roSGNode" then return "n/a (not a node)"
    if a.isSameNode(b) then return "SAME instance"
    return "DIFFERENT instances"
end function

' Reads `field` off a node reached through an AA entry, tolerating an invalid reference.
function fieldOf(node as Dynamic, field as String) as String
    if node = invalid then return "invalid"
    if type(node) <> "roSGNode" then return "not-a-node"
    return describe(node[field])
end function

function joinLines(lines as Object) as String
    out = ""
    for each l in lines
        out = out + l + chr(10)
    end for
    return out
end function
