sub init()
    m.top.createNextPanelOnItemFocus = true
    m.top.list = m.top.findNode("grid")
    m.top.observeFieldScoped("createNextPanelIndex", "onCreateNextPanelIndex")
end sub

sub onCreateNextPanelIndex()
    index = m.top.createNextPanelIndex
    if index < 0 then return
    print "created right panel for index "; index
    panel = CreateObject("roSGNode", "Panel")
    m.top.nextPanel = panel
end sub
