sub Main()
    print "=== Poster Preload Swap Repro ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("PreloadScene")
    screen.show()

    print "visiblePoster.uri = "; scene.visibleUri
    print "preloadPoster.uri = "; scene.preloadUri

    print "=== Poster Preload Swap Repro Complete ==="
end sub
