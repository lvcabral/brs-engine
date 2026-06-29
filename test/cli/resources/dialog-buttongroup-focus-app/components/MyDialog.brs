sub init()
    m.buttons = m.top.findNode("buttons")
end sub

sub setup()
    ' Mirrors setupButtons: create the buttons dynamically.
    m.buttons.callFunc("addButton", "Yes")
    m.buttons.callFunc("addButton", "No")
end sub

' Overrides BaseStdDialog's focusedChild observer: once the dialog itself has focus, hand it to the
' nested button group.
sub onFocusChanged(_nodeEvent as object)
    if m.top.hasFocus() then
        m.buttons.setFocus(true)
    end if
end sub
