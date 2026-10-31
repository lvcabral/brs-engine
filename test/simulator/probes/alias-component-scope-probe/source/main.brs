' Alias Component Scope Probe (issue #1254): which node an interface field alias and findNode()
' resolve when an id is reused inside a sibling custom component's internal children.
' Output: PROBE|<case>|<values...>
sub main()
    ' Gives time to reconnect to the debug console, which drops its clients when an app launches.
    sleep(5000)
    print "PROBE|start"
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.setMessagePort(port)
    screen.CreateScene("MainScene")
    screen.show()
    wait(3000, port)
    print "PROBE|done"
end sub
