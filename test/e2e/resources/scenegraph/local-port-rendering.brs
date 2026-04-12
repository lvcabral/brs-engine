sub main()
    print "=== Local Port Rendering Tests ==="

    ' Test 1: Create screen and screen port (baseline)
    screen = CreateObject("roSGScreen")
    screenPort = CreateObject("roMessagePort")
    screen.setMessagePort(screenPort)
    print "Test 1: Screen and screen port created"

    ' Test 2: Create a local port and wait on it with a short timeout
    ' This should not crash — the screen's render callback should run safely
    localPort = CreateObject("roMessagePort")
    msg = wait(50, localPort)
    print "Test 2: wait() on local port returned: "; type(msg)

    ' Test 3: getMessage() on local port should not crash
    msg = localPort.getMessage()
    print "Test 3: getMessage() on local port returned: "; type(msg)

    ' Test 4: peekMessage() on local port should not crash
    msg = localPort.peekMessage()
    print "Test 4: peekMessage() on local port returned: "; type(msg)

    ' Test 5: Create a node, observe a field on the local port, change it,
    ' and verify the event arrives on the local port
    node = CreateObject("roSGNode", "Node")
    node.observeField("id", localPort)
    node.id = "testNode"
    msg = wait(100, localPort)
    if msg <> invalid
        print "Test 5: Field change event received on local port: "; type(msg)
    else
        print "Test 5: No event received on local port"
    end if

    ' Test 6: Multiple local ports should work independently
    localPort2 = CreateObject("roMessagePort")
    node2 = CreateObject("roSGNode", "Node")
    node2.observeField("id", localPort2)
    node2.id = "testNode2"
    msg2 = wait(100, localPort2)
    if msg2 <> invalid
        print "Test 6: Field change event received on second local port: "; type(msg2)
    else
        print "Test 6: No event received on second local port"
    end if

    print "=== All Local Port Rendering Tests Passed ==="
end sub
