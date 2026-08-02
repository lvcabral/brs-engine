sub Main()
    print "=== RowList SubRect Repro ==="

    grid = CreateObject("roSGNode", "RowList")
    grid.itemComponentName = "RowItem"
    grid.itemSize = [300, 200]
    grid.rowItemSize = [[300, 200]]
    grid.itemSpacing = [0, 0]
    grid.numRows = 2
    ' Off-origin so the reported item y is distinguishable from the grid's own origin and from
    ' any outset applied to the grid's own rect (the item rect must carry neither).
    grid.translation = [40, 120]

    content = CreateObject("roSGNode", "ContentNode")
    for r = 0 to 1
        row = content.createChild("ContentNode")
        item = row.createChild("ContentNode")
        item.title = "R" + r.toStr()
    end for
    grid.content = content

    ' Force an initial render so both rows' item components are created and cached.
    discard = grid.boundingRect()

    band = grid.subBoundingRect("item0_0")
    print "band row0 y = "; band.y

    ' Move focus down to row 1. A real device keeps the focused row at the fixed focus
    ' band, so an app that measures the newly focused item from its rowItemFocused
    ' observer reads the settled band position, not the pre-scroll stacked position.
    grid.jumpToRowItem = [1, 0]

    rect1 = grid.subBoundingRect("item1_0")
    print "focused row1 y = "; rect1.y

    same = Abs(rect1.y - band.y) < 50
    print "SAME BAND: "; same

    ' The reported item rect is the bare item component, so it derives entirely from the
    ' fixture's own declared inputs: it sits at the grid's translation and is exactly one
    ' row item tall. Neither the grid's own rect outset nor the focus 9-patch reaches it.
    print "ON POSTER: "; rect1.y = grid.translation[1]
    print "SIZE IS POSTER: "; rect1.height = grid.rowItemSize[0][1]
    print "=== RowList SubRect Repro Complete ==="
end sub
