sub main()
    di = CreateObject("roDeviceInfo")
    print "GetModel() "; di.GetModel()
    print "GetModelDisplayName() "; di.GetModelDisplayName()
    print "GetModelType() "; di.GetModelType()
    print "GetModelDetails() "; di.GetModelDetails()
    print "GetFriendlyName() "; di.GetFriendlyName()
    print "GetVersion() "; di.GetVersion()
    print "GetOSVersion() "; di.GetOSVersion()
    print "getChannelClientId() "; di.getChannelClientId()
    print "getCountryCode() "; di.getCountryCode()
    print "getuserCountryCode() "; di.getuserCountryCode()
    print "GetTimeZone() "; di.GetTimeZone()
    print "GetCurrentLocale() "; di.GetCurrentLocale()
    print "getClockFormat() "; di.getClockFormat()
    print "getConnectionInfo() "; di.getConnectionInfo()
    print "getConnectionType() "; di.getConnectionType()
    print "getDisplayType() "; di.getDisplayType()
    print "getDisplayMode() "; di.getDisplayMode()
    print "getDisplayAspectRatio() "; di.getDisplayAspectRatio()
    print "getDisplaySize() "; di.getDisplaySize()
    print "getDisplayProperties() "; di.getDisplayProperties()
    print "getUIResolution() "; di.getUIResolution()
    print "getGraphicsPlatform() "; di.getGraphicsPlatform()
    print "getSupportedGraphicsResolutions() "; di.getSupportedGraphicsResolutions()
    print "getIPAddrs() "; di.getIPAddrs()
    print "getLinkStatus() "; di.getLinkStatus()
    print "isAudioGuideEnabled() "; di.isAudioGuideEnabled()
    print "CanDecodeVideo() "; di.CanDecodeVideo({"codec": "mpeg4 avc"})
    print "CanDecodeAudio() "; di.CanDecodeAudio({"codec": "mp3"})
    codecs = di.CanDecodeAudio({})
    print codecs
    if not codecs.result
        print codecs.codec
    end if
    codecs = di.CanDecodeVideo({})
    print codecs
    if not codecs.result
        print codecs.codec
    end if
end sub