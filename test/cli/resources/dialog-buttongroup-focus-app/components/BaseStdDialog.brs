sub init()
    m.top.observeField("focusedChild", "onFocusChanged")
    ' HACK from the real app: strip the StandardDialog framework's auto-added children.
    m.top.removeChildrenIndex(m.top.getChildCount(), 0)
end sub

' Base handler, overridden by the derived component (mirrors baseStandardDialog.brs).
sub onFocusChanged(nodeEvent as object)
    ' Overwrite by extend
end sub
