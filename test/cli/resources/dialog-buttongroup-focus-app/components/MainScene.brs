sub init()
    m.nullFocus = m.top.findNode("nullFocus")
end sub

' Mirrors pplus-proxy baseOnDialogChanged: runs inside the field observer, parks focus on the null
' holder, assigns the dialog, then explicitly focuses it.
sub onDialogChanged(nodeEvent as object)
    dialog = nodeEvent.getData()
    if dialog <> invalid then
        m.nullFocus.setFocus(true)
        m.top.dialog = dialog
        m.top.dialog.setFocus(true)
    end if
end sub
