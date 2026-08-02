' Included explicitly by every component: pkg:/source is not in component scope
' (confirmed on device — "Function is not defined in component's namespace").

function fmt(v as Dynamic) as String
    if v = invalid then return "invalid"

    t = type(v)
    if t = "String" or t = "roString" then return "'" + v + "'"
    if t = "Boolean" or t = "roBoolean"
        if v then return "true"
        return "false"
    end if
    if t = "Integer" or t = "roInt" or t = "roInteger" then return str(v).Trim()
    if t = "Float" or t = "roFloat" or t = "Double" or t = "roDouble" then return str(v).Trim()
    if t = "roSGNode" then return v.subtype() + "#" + v.id
    if t = "roAssociativeArray" then return "AA(" + str(v.Count()).Trim() + ")"
    if t = "roArray" then return "Array(" + str(v.Count()).Trim() + ")"
    return "<" + t + ">"
end function

sub emit(lines as Object, id as String, value as Dynamic)
    lines.push(id + " = " + fmt(value))
end sub

function joinLines(lines as Object) as String
    out = ""
    for each line in lines
        out = out + line + chr(10)
    end for
    return out
end function
