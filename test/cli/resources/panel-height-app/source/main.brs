sub Main()
    print "=== Panel Height Repro ==="

    panelSet = CreateObject("roSGNode", "PanelSet")
    panelSet.height = 1080

    ' The component observes its own height in init(), before it is attached.
    panel = CreateObject("roSGNode", "DetailPanel")
    print "detached height = "; panel.height

    ' Attaching the panel must set its height from the PanelSet (notifying observers).
    panelSet.appendChild(panel)
    print "attached height = "; panel.height

    ' A later PanelSet height change propagates to attached panels.
    panelSet.height = 720
    print "resized height = "; panel.height

    print "=== Panel Height Repro Complete ==="
end sub
