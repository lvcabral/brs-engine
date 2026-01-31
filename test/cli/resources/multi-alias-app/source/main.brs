sub Main()
    ' Test multi-field alias functionality
    print "=== Testing Multi-Field Alias ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    ' Create the custom component with multi-field alias
    scene = screen.CreateScene("MultiAliasTest")
    screen.show()

    ' Get the child labels
    label1 = scene.findNode("label1")
    label2 = scene.findNode("label2")
    label3 = scene.findNode("label3")

    print "Initial state:"
    print "label1.text = "; label1.text
    print "label2.text = "; label2.text
    print "label3.text = "; label3.text

    ' Set the alias field - should set all three label texts
    scene.syncedValue = "Hello, World!"

    ' Verify all three labels received the value
    print ""
    print "After setting syncedValue to 'Hello, World!':"
    print "label1.text = "; label1.text
    print "label2.text = "; label2.text
    print "label3.text = "; label3.text

    ' Update the alias in a child label and verify propagation
    label2.text = "Updated Value"

    ' Verify all three labels updated
    print ""
    print "After updating label2 to 'Updated Value':"
    print "scene.syncedValue = "; scene.syncedValue
    print "label1.text = "; label1.text
    print "label2.text = "; label2.text
    print "label3.text = "; label3.text

    print ""
    print "=== Test Complete ==="
end sub
