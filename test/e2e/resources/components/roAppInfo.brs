sub main()
    appInfo = createObject("roAppInfo")

    print appInfo.getID()
    print appInfo.isDev()
    print appInfo.getVersion()
    print appInfo.getTitle()
    print appInfo.getSubtitle()
    print appInfo.getDevID()
    print appInfo.getValue("requires_audiometadata")

end sub
