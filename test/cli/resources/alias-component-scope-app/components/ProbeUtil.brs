function show(n as dynamic) as string
    if n = invalid then return "invalid"
    s = n.subtype() + "#" + n.id
    if n.hasField("maxHeight") then s = s + ":maxHeight=" + n.maxHeight.toStr()
    if n.hasField("text") then s = s + ":text=" + n.text
    return s
end function

sub out(name as string, values as object)
    line = "PROBE|" + name
    for each v in values
        line = line + "|" + v
    end for
    print line
end sub

function fieldOf(n as object, f as string) as string
    if not n.hasField(f) then return "nofield"
    v = n.getField(f)
    if v = invalid then return "invalid"
    return v.toStr()
end function
