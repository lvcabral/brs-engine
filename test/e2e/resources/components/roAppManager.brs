sub Main(args)
    if args?.contentId <> invalid
        print "Content Id: "; args.contentId
    end if
    if args?.mediaType <> invalid
        print "Media Type: "; args.mediaType
    end if
    m.app = CreateObject("roAppManager")
    print "Uptime: "; m.app.GetUpTime()
    print "ScreenSaverTimeout:"; m.app.GetScreenSaverTimeout()
    for each app in m.app.getAppList()
        print "App Title: "; app.title
    end for
    if m.app.isAppInstalled("home-01", "")
        print "App Installed!"
    end if
end sub