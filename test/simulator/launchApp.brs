sub main()
    app = CreateObject("roAppManager")
    app.launchApp("home-03", "", {contentId: "123", mediaType: "video"})
    print "Uptime: "; app.GetUpTime()
end sub