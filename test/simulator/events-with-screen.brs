
sub main()
    port = CreateObject("roMessagePort")
	screen = CreateObject("roScreen")
	screen.SetMessagePort(port)
    di = CreateObject("roDeviceInfo")
    di.SetMessagePort(port)
    cec = CreateObject("roCECStatus")
    print "roCECStatus.isActiveSource() = "; cec.isActiveSource()
    cec.SetMessagePort(port)
    syslog = CreateObject("roSystemLog")
    syslog.SetMessagePort(port)
    syslog.EnableType("bandwidth.minute")
    store = CreateObject("roChannelStore")
    store.SetMessagePort(port)
    store.GetCatalog()
    input = CreateObject("roInput")
    input.SetMessagePort(port)
    while true
        msg = port.WaitMessage(0)
        print type(msg)
        if type(msg) = "roCECStatusEvent"
            print msg.getMessage()
            print msg.getIndex()
            print msg.getInfo()
            print FindMemberFunction(msg, "getInfo")
            print FindMemberFunction(cec, "setMessagePort")
		else if type(msg) = "roUniversalControlEvent"
			print msg.getInt()
        else if type(msg) = "roInputEvent"
            print "roInputEvent.isInput = "; msg.isInput()
            print msg.getInfo()
            print FindMemberFunction(msg, "getInfo")
            print FindMemberFunction(input, "setMessagePort")
        else if type(msg) = "roDeviceInfoEvent"
            print "roDeviceInfoEvent.isCaptionModeChanged = "; msg.isCaptionModeChanged()
            print "roDeviceInfoEvent.isStatusMessage = "; msg.isStatusMessage()
            print msg.getInfo()
            print FindMemberFunction(msg, "getInfo")
        else if type(msg) = "roChannelStoreEvent"
            print msg.getResponse()
            print FindMemberFunction(msg, "getResponse")
        else if type(msg) = "roSystemLogEvent"
            logEvent = msg.getInfo()
            if logEvent.logType = "bandwidth.minute"
                print logEvent.logType, logEvent.dateTime.toISOString(), logEvent.bandwidth
            end if
            print FindMemberFunction(msg, "getInfo")
            print FindMemberFunction(syslog, "setMessagePort")
        end if
    end while
end sub
