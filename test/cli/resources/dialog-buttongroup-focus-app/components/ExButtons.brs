sub init()
    m.top.observeFieldScoped("focusedChild", "onFocusChanged")
end sub

sub addButton(label as string)
    btn = m.top.createChild("Label")
    btn.text = label
end sub

sub onFocusChanged(_nodeEvent as object)
    if m.top.hasFocus() then
        print "  ExButtons received focus -> highlight first button"
    end if
end sub
