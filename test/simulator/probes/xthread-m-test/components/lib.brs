' Included explicitly by every component (pkg:/source is not in component scope).

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"

    t = type(v)
    if t = "String" or t = "roString" then return v
    if t = "Boolean" or t = "roBoolean"
        if v then return "true"
        return "false"
    end if
    if t = "Integer" or t = "roInt" or t = "roInteger" then return str(v).Trim()
    if t = "Float" or t = "roFloat" or t = "Double" or t = "roDouble" then return str(v).Trim()
    if t = "LongInteger" or t = "roLongInteger" then return str(v).Trim()
    if t = "roSGNode" then return v.subtype() + "#" + v.id
    return "<" + t + ">"
end function

function joinLines(lines as Object) as String
    out = ""
    for each line in lines
        out = out + line + chr(10)
    end for
    return out
end function
