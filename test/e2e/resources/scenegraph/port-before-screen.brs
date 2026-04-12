sub main()
    print "=== Port Before Screen Tests ==="

    ' Test 1: Create a port BEFORE the screen exists
    ' The port should be retroactively registered when the screen is created
    earlyPort = CreateObject("roMessagePort")
    print "Test 1: Port created before screen"

    ' Now create the screen — pending ports should be flushed
    screen = CreateObject("roSGScreen")
    screenPort = CreateObject("roMessagePort")
    screen.setMessagePort(screenPort)
    print "Test 2: Screen created after port"

    ' Test 3: wait() on the early port should work (render callback registered)
    msg = wait(50, earlyPort)
    print "Test 3: wait() on early port returned: "; type(msg)

    ' Test 4: Observe a field on the early port and verify events arrive
    node = CreateObject("roSGNode", "Node")
    node.observeField("id", earlyPort)
    node.id = "earlyTest"
    msg = wait(100, earlyPort)
    if msg <> invalid
        print "Test 4: Field change event on early port: "; type(msg)
    else
        print "Test 4: No event received on early port"
    end if

    print "=== All Port Before Screen Tests Passed ==="
end sub
