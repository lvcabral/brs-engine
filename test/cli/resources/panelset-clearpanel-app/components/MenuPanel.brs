sub init()
    ' Enable the create-next-panel mechanism.
    m.top.createNextPanelOnItemFocus = true

    m.grid = m.top.findNode("grid")
    m.content = m.top.findNode("menuContent")

    ' Associate the XML-declared grid with the ListPanel's grid/list field.
    m.top.list = m.grid

    ' Populate the content node in place. Items: 0 = has focusable detail panel,
    ' 1 = About (labels-only, focusable=false), 2 = Exit (no next panel supplied).
    titles = ["Detail", "About", "Exit"]
    for i = 0 to 2
        item = m.content.createChild("ContentNode")
        item.title = titles[i]
        item.id = titles[i] + "Button"
    end for

    m.top.observeFieldScoped("createNextPanelIndex", "onCreateNextPanelIndex")
end sub

' Fires each time a grid item is focused. The app builds the matching right panel and assigns it to
' nextPanel — except for the "Exit" item, where it deliberately supplies nothing (mirroring an app
' whose createNextPanel returns invalid), which must clear the trailing detail panel.
sub onCreateNextPanelIndex()
    index = m.top.createNextPanelIndex
    if index < 0 then return
    buttonContent = m.content.getChild(index)

    nextPanel = invalid
    if buttonContent.id = "DetailButton"
        nextPanel = CreateObject("roSGNode", "DetailPanel")
    else if buttonContent.id = "AboutButton"
        nextPanel = CreateObject("roSGNode", "AboutPanel")
        nextPanel.focusable = false
    end if

    if nextPanel <> invalid
        m.top.nextPanel = nextPanel
    end if
end sub
