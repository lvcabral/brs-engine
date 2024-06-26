sub main()
    deviceInfo = createObject("roDeviceInfo")

    print deviceInfo.getModel()
    print deviceInfo.getModelDisplayName()
    print deviceInfo.getModelType()
    print deviceInfo.getModelDetails().count()
    print deviceInfo.getFriendlyName()
    print deviceInfo.getOSVersion().count()
    print deviceInfo.getVersion()
    print deviceInfo.getRIDA()
    print deviceInfo.isRIDADisabled()
    print deviceInfo.getChannelClientId()
    uuid = deviceInfo.getRandomUUID()
    print len(uuid)
    print deviceInfo.getTimeZone()
    print deviceInfo.hasFeature("on")

    print deviceInfo.getCurrentLocale()
    print deviceInfo.getCountryCode()
    print deviceInfo.getUserCountryCode()
    ' _brs_.process.setLocale("fr_CA")
    ' print deviceInfo.getCurrentLocale()
    ' print deviceInfo.getCountryCode()
    ' print deviceInfo.getUserCountryCode()

    print deviceInfo.getPreferredCaptionLanguage()
    print deviceInfo.timeSinceLastKeyPress()
    print deviceInfo.getDrmInfo().count()
    print deviceInfo.getDrmInfoEx().count()
    print deviceInfo.setCaptionsMode("On")
    print deviceInfo.getCaptionsMode()
    print deviceInfo.getCaptionsOption("text/font")
    print deviceInfo.getClockFormat()
    print deviceInfo.enableAppFocusEvent(true)
    print deviceInfo.enableScreensaverExitedEvent(true)
    print deviceInfo.enableLowGeneralMemoryEvent(true)
    print deviceInfo.getGeneralMemoryLevel()
    print deviceInfo.isStoreDemoMode()
    print deviceInfo.getLinkStatus()
    print deviceInfo.enableLinkStatusEvent(true)
    print deviceInfo.getConnectionType()
    print deviceInfo.getExternalIp()
    print deviceInfo.getIPAddrs().count()
    print deviceInfo.getConnectionInfo().count()
    print deviceInfo.getDisplayType()
    print deviceInfo.getDisplayMode()
    print deviceInfo.getDisplayAspectRatio()
    print deviceInfo.getDisplaySize().count()
    print deviceInfo.getVideoMode()
    print deviceInfo.getDisplayProperties().count()
    print deviceInfo.getSupportedGraphicsResolutions().count()
    decodeVideo = deviceInfo.canDecodeVideo({"codec": "mpeg4 avc"})
    print decodeVideo.result
    print decodeVideo.codec
    print deviceInfo.getUIResolution().count()
    print deviceInfo.getGraphicsPlatform()
    print deviceInfo.enableCodecCapChangedEvent(true)
    print deviceInfo.getAudioOutputChannel()
    print deviceInfo.getAudioDecodeInfo().count()
    audioDecoderInfo = deviceInfo.canDecodeAudio({"codec": "aac"})
    print audioDecoderInfo.result
    print deviceInfo.getSoundEffectsVolume()
    print deviceInfo.isAudioGuideEnabled()
    print deviceInfo.enableAudioGuideChangedEvent(true)

end sub
