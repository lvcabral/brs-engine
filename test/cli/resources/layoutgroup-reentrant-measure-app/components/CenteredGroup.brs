sub init()
    m.top.layoutDirection = "horiz"
    m.top.itemSpacings = 20
end sub

sub center()
    for i = 0 to m.top.getChildCount() - 1
        button = m.top.getChild(i)
        if not button.isReady
            button.observeField("isReady", "onButtonReady")
            return
        end if
    end for
    rect = m.top.boundingRect()
    print "centering width = "; rect.width
    m.top.translation = [(1920 - rect.width) / 2, m.top.translation[1]]
end sub

sub onButtonReady()
    center()
end sub
