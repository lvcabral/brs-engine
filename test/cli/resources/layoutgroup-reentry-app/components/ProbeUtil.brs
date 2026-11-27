function fmtNum(v as dynamic) as string
    if Int(v) = v then return Int(v).toStr()
    return Str(v).trim()
end function

function fmtPair(p as object) as string
    return "[" + fmtNum(p[0]) + "," + fmtNum(p[1]) + "]"
end function

function fmtRect(r as object) as string
    return "{" + fmtNum(r.x) + "," + fmtNum(r.y) + "," + fmtNum(r.width) + "," + fmtNum(r.height) + "}"
end function

' Every child's id and translation, in order.
function fmtKids(group as object) as string
    parts = []
    for i = 0 to group.getChildCount() - 1
        kid = group.getChild(i)
        parts.push(kid.id + "=" + fmtPair(kid.translation))
    end for
    return parts.join(" ")
end function
