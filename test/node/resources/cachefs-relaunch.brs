sub main()
    fs = CreateObject("roFileSystem")
    print "cachefs:"; fs.Exists("cachefs:/probe.txt")
    print "tmp:"; fs.Exists("tmp:/probe.txt")
    WriteAsciiFile("cachefs:/probe.txt", "cached")
    WriteAsciiFile("tmp:/probe.txt", "temporary")
end sub
