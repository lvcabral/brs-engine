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

    print "=== Group Scale Repro Complete ==="
end sub

sub printRect(name as string, rect as object)
    print name; " = "; Int(rect.x + 0.5); ","; Int(rect.y + 0.5); " "; Int(rect.width + 0.5); "x"; Int(rect.height + 0.5)
end sub
