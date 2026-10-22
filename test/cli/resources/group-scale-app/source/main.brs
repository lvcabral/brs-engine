sub Main()
    print "=== Group Scale Repro ==="

    ' A scaled Group must scale everything below it: on a device a 64x64 child of a
    ' Group with scale [0.5, 0.5] covers 32x32 in scene space, and the pivot
    ' (scaleRotateCenter) stays fixed while the Group scales or rotates.
    root = CreateObject("roSGNode", "Group")

    ball = root.createChild("Group")
    ball.translation = [400, 300]
    ball.scaleRotateCenter = [32, 32]
    ball.scale = [0.5, 0.5]
    shade = ball.createChild("Rectangle")
    shade.width = 64
    shade.height = 64
    printRect("scaled child", shade.sceneBoundingRect())
    printRect("scaled group", ball.boundingRect())

    nested = ball.createChild("Group")
    nested.scale = [0.5, 0.5]
    dot = nested.createChild("Rectangle")
    dot.width = 64
    dot.height = 64
    printRect("nested child", dot.sceneBoundingRect())

    spun = root.createChild("Group")
    spun.translation = [100, 100]
    spun.scaleRotateCenter = [32, 32]
    spun.rotation = 3.14159265
    chip = spun.createChild("Rectangle")
    chip.width = 32
    chip.height = 32
    printRect("rotated child", chip.sceneBoundingRect())

    ' A node rotated about its own center inside a rotated Group turns about that same
    ' pivot, content and children alike: on a device the 100x100 square covers
    ' {1379,-21,141,141} and its 20x20 child {1436,92,28,28}.
    turned = root.createChild("Group")
    turned.translation = [1400, 100]
    turned.rotation = 1.5707963
    tile = turned.createChild("Rectangle")
    tile.width = 100
    tile.height = 100
    tile.rotation = 0.7853982
    tile.scaleRotateCenter = [50, 50]
    corner = tile.createChild("Rectangle")
    corner.width = 20
    corner.height = 20
    printRect("turned tile", tile.sceneBoundingRect())
    printRect("turned tile child", corner.sceneBoundingRect())

    ' A LayoutGroup under a scaled Group still lays out in its own (unscaled) units:
    ' on a device the third 50x50 item sits at [0, 120] and covers 25x25 in scene space.
    stack = root.createChild("Group")
    stack.translation = [400, 100]
    stack.scale = [0.5, 0.5]
    column = stack.createChild("LayoutGroup")
    column.layoutDirection = "vert"
    column.itemSpacings = [10]
    for i = 1 to 3
        item = column.createChild("Rectangle")
        item.width = 50
        item.height = 50
    end for
    printRect("layout item", item.sceneBoundingRect())
    print "layout item translation = "; item.translation[0]; ","; item.translation[1]

    ' A grid item's subBoundingRect stays in the grid's parent units under a scaled
    ' ancestor: on a device a 100x100 PosterGrid item under a 0.5 Group reports
    ' 100x100, while its sceneSubBoundingRect covers 50x50.
    shelf = root.createChild("Group")
    shelf.translation = [100, 420]
    shelf.scale = [0.5, 0.5]
    grid = shelf.createChild("PosterGrid")
    grid.basePosterSize = [100, 100]
    grid.numColumns = 3
    grid.numRows = 1
    grid.itemSpacing = [20, 0]
    posters = CreateObject("roSGNode", "ContentNode")
    for i = 0 to 2
        posters.createChild("ContentNode")
    end for
    grid.content = posters
    printRect("grid item", grid.subBoundingRect("item0_0"))
    printRect("grid item scene", grid.sceneSubBoundingRect("item0_0"))

    print "=== Group Scale Repro Complete ==="
end sub

sub printRect(name as string, rect as object)
    print name; " = "; Int(rect.x + 0.5); ","; Int(rect.y + 0.5); " "; Int(rect.width + 0.5); "x"; Int(rect.height + 0.5)
end sub
