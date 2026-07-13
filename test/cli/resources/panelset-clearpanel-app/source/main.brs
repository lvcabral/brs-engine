sub Main()
    print "=== PanelSet ClearPanel Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()

    panelSet = scene.findNode("panelSet")

    menuPanel = CreateObject("roSGNode", "MenuPanel")
    panelSet.appendChild(menuPanel)

    ' Focus the menu Panel directly. Focus cascades to the grid, whose default item (index 0) becomes
    ' focused, creating the focusable detail panel.
    scene.setFocus(true)
    menuPanel.setFocus(true)
    print "item 0 numPanels = "; panelSet.numPanels

    ' Focus item 1 (About): the app supplies a focusable=false panel. It replaces the detail panel,
    ' so numPanels stays 2 (the informational panel is displayed).
    grid = menuPanel.findNode("grid")
    grid.jumpToItem = 1
    print "item 1 numPanels = "; panelSet.numPanels

    ' Focus item 2 (Exit): the app supplies no next panel. The trailing detail panel must be cleared,
    ' leaving only the menu panel.
    grid.jumpToItem = 2
    print "item 2 numPanels = "; panelSet.numPanels

    ' Back to item 0: a focusable detail panel must be created again (numPanels 1 -> 2).
    grid.jumpToItem = 0
    print "back to 0 numPanels = "; panelSet.numPanels

    ' Re-focus the same item 0 (as happens when the PanelSet re-focuses the menu from the left, e.g.
    ' going back). createNextPanelIndex fires again for the same index; the app re-supplies the same
    ' detail panel, so the panel must NOT be cleared — numPanels stays 2.
    menuPanel.setFocus(false)
    menuPanel.setFocus(true)
    print "re-focus 0 numPanels = "; panelSet.numPanels

    print "=== PanelSet ClearPanel Repro Complete ==="
end sub
