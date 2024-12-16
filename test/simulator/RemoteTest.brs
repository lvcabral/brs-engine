sub main()
    m.remote = CreateObject("roRemoteInfo")
	if m.remote <> invalid
        for i = -1 to 9
            print "--- Remote Info ---"
            print "Model: "; m.remote.getModel(i)
            print "IsAwake: "; m.remote.isAwake(i)
            print "--- Remote Features ---"
            print "wifi remote? "; m.remote.hasFeature("WiFi",i)
            print "bluetooth remote? "; m.remote.hasFeature("bluetooth",i)
            print "motion remote? "; m.remote.hasFeature("motion",i)
            print "audio remote? "; m.remote.hasFeature("audio",i)
            print "voice capture remote? "; m.remote.hasFeature("voicecapture",i)
            print "find remote remote? "; m.remote.hasFeature("findremote",i)
            print "hasMuteSwitch? "; m.remote.hasFeature("hasMuteSwitch",i)
            print "Mute Switch? "; m.remote.hasFeature("MuteSwitch",i)
            print "--- Simulator Only Features ---"
            print "Keyboard? "; m.remote.hasFeature("Keyboard",i)
            print "GamePad? "; m.remote.hasFeature("Gamepad",i)
            if m.remote.getModel(i) = 0
                exit for
            end if
        end for
    end if
    screen = CreateObject("roScreen", true, 854, 480)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
	while true
		event = wait(0, port)
        key = event.getInt()
        if key = 0
            exit while
        else
            print key
			print event.getRemoteId()
        end if
    end while
end sub