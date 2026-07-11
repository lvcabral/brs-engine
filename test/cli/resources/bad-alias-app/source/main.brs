sub Main()
    print "=== Testing Failed Alias Targets ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    scene = screen.CreateScene("BadAliasTest")
    screen.show()

    ' A field declared after the failed aliases must exist (no trailing-field cascade)
    print "scene.trailing = "; scene.trailing

    ' First target was a missing node: the alias still bound to the later valid target
    scene.firstBad = "bound"
    print "label1.text = "; scene.findNode("label1").text

    ' Middle target was a missing field: the valid siblings around it still bound
    scene.midBad = "synced"
    print "label2.text = "; scene.findNode("label2").text
    print "label3.text = "; scene.findNode("label3").text

    ' An alias with no resolvable target creates no field
    print "hasField allBad = "; scene.hasField("allBad")

    print "=== Test Complete ==="
end sub
