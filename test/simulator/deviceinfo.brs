sub main()
    di = CreateObject("roDeviceInfo")
    print di.GetModel()
    print di.GetModelDisplayName()
    print di.GetModelType()
    print di.GetModelDetails()
    print di.GetFriendlyName()
    print di.GetVersion()
    print di.getChannelClientId()
    print di.getCountryCode()
    print di.getuserCountryCode()
    print di.GetRandomUUID()
    print di.GetTimeZone()
    print di.GetCurrentLocale()
    print di.getClockFormat()
    print di.getDisplayType()
    print di.getDisplayMode()
    print di.getDisplayAspectRatio()
    print di.getDisplaySize()
    print di.getUIResolution()
    print di.getGraphicsPlatform()
    print di.getIPAddrs()
    print di.getLinkStatus()
    print di.CanDecodeVideo({"codec": "mpeg4 avc"})
    print di.CanDecodeAudio({"codec": "mp3"})
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