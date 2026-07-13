sub Main()
    print "=== Button Measure Repro ==="

    grid = CreateObject("roSGNode", "MarkupGrid")
    grid.itemComponentName = "PillButton"
    grid.itemSize = [300, 72]
    grid.itemSpacing = [0, 12]
    grid.numRows = 3
    grid.numColumns = 1

    content = CreateObject("roSGNode", "ContentNode")
    for i = 1 to 2
        item = content.createChild("ContentNode")
        item.title = "Live Right Now"
    end for
    grid.content = content

    ' A bounding-rect query refreshes layout by rendering the whole tree, which lazily
    ' creates the item components above and assigns their itemContent during that render.
    ' Each item then measures its own content with boundingRect() while the pass is active.
    rect = grid.boundingRect()
    print "grid rect height = "; rect.height

    print "=== Button Measure Repro Complete ==="
end sub
