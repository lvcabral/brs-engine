sub Main()
    print "=== PanelSet NextPanel Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("MainScene")
    screen.show()

    panelSet = scene.findNode("panelSet")

    menuPanel = CreateObject("roSGNode", "MenuPanel")
    panelSet.appendChild(menuPanel)
    print "before focus numPanels = "; panelSet.numPanels

    ' Mirror the real app: the screen focuses the menu Panel directly (never the PanelSet).
    ' Focus cascades to the menu grid, whose default item (index 0) becomes focused, which must
    ' trigger createNextPanelIndex → nextPanel → the right panel being appended — even though
    ' hasNextPanel was never set on the menu panel.
    scene.setFocus(true)
    menuPanel.setFocus(true)

    print "after focus numPanels = "; panelSet.numPanels

    print "=== PanelSet NextPanel Repro Complete ==="
end sub
