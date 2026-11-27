sub init()
    m.count = 0
    m.top.observeField("translation", "onMoved")
end sub

' Prints what the observer sees: its own translation, every sibling's translation before and after
' the boundingRect() query, and the rect the query returned.
sub onMoved()
    m.count++
    lg = m.top.getParent()
    line = "PROBE|" + m.top.caseId + "|obs-" + m.top.id + "-" + m.count.toStr() + "|self=" + fmtPair(m.top.translation)
    if lg <> invalid
        line = line + " before: " + fmtKids(lg)
        target = invalid
        if m.top.mode = "respace"
            ' Changes the layout before querying it.
            lg.itemSpacings = [30]
            target = lg
        else if m.top.mode = "append"
            if m.count = 1
                extra = CreateObject("roSGNode", "Rectangle")
                extra.id = "k3"
                extra.width = 100
                extra.height = 40
                lg.appendChild(extra)
            end if
            target = lg
        else if m.top.mode = "measure"
            target = lg
        else if m.top.mode = "ancestor"
            target = lg.getParent()
        end if
        if target <> invalid
            line = line + " | rect(" + target.id + ")=" + fmtRect(target.boundingRect())
            line = line + " | after: " + fmtKids(lg)
        end if
    end if
    print line
end sub
