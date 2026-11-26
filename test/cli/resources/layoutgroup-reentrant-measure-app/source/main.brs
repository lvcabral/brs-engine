' A horizontal group of buttons under a view that starts hidden. Each button sizes itself when
' renderTracking reports "full" (its first painted frame), and the group centers itself by its
' boundingRect() once every button is ready: that query runs while the group is still painting.
sub main()
    print "=== LayoutGroup Re-entrant Measure Repro ==="
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    scene = screen.CreateScene("MainScene")
    screen.show()
    wait(100, port)
    view = CreateObject("roSGNode", "RepView")
    scene.appendChild(view)
    wait(100, port)
    view.visible = true
    group = view.findNode("buttons")
    ' Until the group has centered itself, capped at 5s; then a few frames so a relayout settles.
    timer = CreateObject("roTimespan")
    while group.translation[0] = 0 and timer.TotalMilliseconds() < 5000
        wait(30, port)
    end while
    for i = 1 to 5
        wait(30, port)
    end for
    for i = 0 to group.getChildCount() - 1
        button = group.getChild(i)
        print button.id; " x = "; button.translation[0]
    end for
    print "group x = "; group.translation[0]
    print "=== LayoutGroup Re-entrant Measure Complete ==="
end sub
