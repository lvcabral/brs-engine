sub init()
    m.top.functionName = "runTask"
end sub

sub runTask()
    lines = []
    cfg = m.global.configNode
    if cfg = invalid
        lines.push("configNode           = invalid  (reference did not resolve)")
    else
        lines.push("configNode.id        = " + describe(cfg.id))
        lines.push("configNode.apiKey    = " + describe(cfg.apiKey) + "   (runtime-added field)")
        lines.push("configNode.region    = " + describe(cfg.region) + "   (runtime-added field)")
    end if

    mgr = m.global.contentManager
    if mgr = invalid
        lines.push("contentManager       = invalid")
    else
        lines.push("contentManager.id    = " + describe(mgr.id))
        lines.push("contentManager count = " + str(mgr.getChildCount()).Trim() + "   (40 on the render thread)")
    end if
    m.top.report = joinLines(lines)
end sub

function describe(v as Dynamic) as String
    if v = invalid then return "invalid"
    if type(v) = "roSGNode" then return v.subtype() + "#" + v.id
    return "'" + v + "'"
end function

function joinLines(lines as Object) as String
    out = ""
    for each l in lines
        out = out + l + chr(10)
    end for
    return out
end function
