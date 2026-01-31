sub TestObservers()
    print "=== Testing Multi-Field Alias with Observers ==="

    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)

    ' Create the custom component with multi-field alias
    scene = screen.CreateScene("ObserverTest")
    screen.show()

    ' Wait a moment for init to complete
    sleep(100)

    print ""
    print "Setting scene.syncedValue to 'First Value'"
    scene.syncedValue = "First Value"

    ' Wait for observer callbacks
    sleep(100)

    print ""
    print "Setting label1.text to 'Second Value'"
    label1 = scene.findNode("label1")
    label1.text = "Second Value"

    ' Wait for observer callbacks
    sleep(100)

    print ""
    print "=== Observer Test Complete ==="
end sub

sub Main()
    TestObservers()
end sub