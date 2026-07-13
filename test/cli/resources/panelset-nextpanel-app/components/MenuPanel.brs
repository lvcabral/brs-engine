sub init()
    ' Enable the create-next-panel mechanism. hasNextPanel is deliberately left at its default
    ' (false): the right panel must still be created when a grid item receives focus.
    m.top.createNextPanelOnItemFocus = true

    m.grid = m.top.findNode("grid")
    m.content = m.top.findNode("menuContent")

    ' Associate the XML-declared grid with the ListPanel's grid/list field.
    m.top.list = m.grid

    ' Populate the (already-assigned) content node in place, like ContentNode.update() — the grid's
    ' content field was set to this node while it was empty, so no item is focused yet.
    for i = 1 to 3
        item = m.content.createChild("ContentNode")
        item.title = "Menu " + i.toStr()
    end for

    m.top.observeFieldScoped("createNextPanelIndex", "onCreateNextPanelIndex")
end sub

' Fires when a grid item is focused (createNextPanelOnItemFocus mechanism). The app responds by
' building the right panel and assigning it to nextPanel, which the PanelSet must then append.
sub onCreateNextPanelIndex()
    index = m.top.createNextPanelIndex
    if index < 0 then return
    if m.nextPanelCreated = true then return
    m.nextPanelCreated = true
    print "created right panel for index "; index
    panel = CreateObject("roSGNode", "Panel")
    panel.hasNextPanel = false
    m.top.nextPanel = panel
end sub
