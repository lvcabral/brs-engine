sub main()
    m.remote = CreateObject("roRemoteInfo")
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
end sub