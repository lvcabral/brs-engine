sub init()
    m.bg = m.top.findNode("bg")
    m.label = m.top.findNode("label")
    m.top.focusable = true
end sub

sub onTextChanged()
    m.label.text = m.top.text
end sub

sub onWidthChanged()
    m.bg.width = m.top.width
    m.label.width = m.top.width
end sub

function onKeyEvent(key as string, press as boolean) as boolean
    if press and key = "OK"
        m.top.selected = true
        return true
    end if
    return false
end function
