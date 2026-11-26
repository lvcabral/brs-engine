sub init()
    m.calls = 0
    m.lbl = m.top.findNode("lbl")
end sub

' Each item stops writing after 5 calls, so a list that re-assigns itemContent on every write prints
' calls up to 5 instead of looping forever.
sub onItemContentChange()
    c = m.top.itemContent
    if c = invalid then return
    m.calls = m.calls + 1
    print "PROBE|call|item=" + c.id + " calls=" + m.calls.toStr()
    m.lbl.text = c.id
    if m.calls >= 5 then return
    if c.id = "same-update"
        c.update({ actionId: "details" }, true)
    else if c.id = "same-assign"
        c.title = "fixed"
    else if c.id = "new-assign"
        c.description = "d" + m.calls.toStr()
    end if
end sub
