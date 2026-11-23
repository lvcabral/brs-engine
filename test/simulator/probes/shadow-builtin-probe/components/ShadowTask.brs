sub init()
    m.top.functionName = "probeTask"
end sub

sub probeTask()
    n = m.top.nodeIn
    r = "in.subtype=" + n.subtype()
    r += "|in.isSubtype(Group)=" + n.isSubtype("Group").toStr()
    r += "|in.isSubtype(LayoutGroup)=" + n.isSubtype("LayoutGroup").toStr()
    r += "|in.shadowTag=" + n.shadowTag
    r += "|in.describe=" + n.callFunc("describe")
    t = CreateObject("roSGNode", "ButtonGroup")
    r += "|task.subtype=" + t.subtype()
    r += "|task.isSubtype(LayoutGroup)=" + t.isSubtype("LayoutGroup").toStr()
    r += "|task.shadowTag=" + orInvalid(t.shadowTag)
    m.top.report = r
end sub

function orInvalid(v as Dynamic) as String
    if v = invalid then return "invalid"
    return v
end function
