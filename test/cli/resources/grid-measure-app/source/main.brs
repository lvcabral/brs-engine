sub Main()
    print "=== Grid Measure Repro ==="

    grid = CreateObject("roSGNode", "MarkupGrid")
    grid.itemComponentName = "MeasureItem"
    grid.itemSize = [438, 72]
    grid.itemSpacing = [0, 12]
    grid.numRows = 5
    grid.numColumns = 1

    content = CreateObject("roSGNode", "ContentNode")
    for i = 1 to 3
        item = content.createChild("ContentNode")
        item.title = "Item " + i.toStr()
    end for
    grid.content = content

    ' A bounding-rect query outside a frame render refreshes layout by rendering the
    ' whole tree, which lazily creates the item components above. Their height
    ' observers query boundingRect() while that refresh is running — this must not
    ' recurse into another refresh (stack overflow before the fix).
    rect = grid.boundingRect()
    print "grid rect height = "; rect.height

    print "=== Grid Measure Repro Complete ==="
end sub
