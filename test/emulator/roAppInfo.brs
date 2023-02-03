sub main()
    appInfo = CreateObject("roAppInfo")

    print "     ID: " ; appInfo.GetID()
    print "  IsDev: " ; appInfo.IsDev()
    print "  DevID: " ; appInfo.GetDevID()
    print "  Title: " ; appInfo.GetTitle()
    print "Version: " ; appInfo.GetVersion()
    print "MajVers: " ; appInfo.GetValue("major_version")
end sub