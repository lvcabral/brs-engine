sub main()
    port = CreateObject("roMessagePort")
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
    for t = 1 to 10
        msg = port.getMessage()
        print type(msg)
        if type(msg) = "roCECStatusEvent"
            print msg.getMessage()
            print msg.getIndex()
            print msg.getInfo()
            print FindMemberFunction(msg, "getInfo")
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
        else msg = invalid
            exit for
        end if
    end for
end sub