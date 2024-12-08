sub main()
    ndk = CreateObject("roNDK")
    print ndk.start("SDKLauncher", ["ChannelId=home-03", "contentId=456", "mediaType=series"])
    print "end of test"
end sub