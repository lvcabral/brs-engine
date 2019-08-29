sub main()
    print ListDir("pkg:/")
    print ListDir("pkg:/assets/")
    print ListDir("pkg:/assets/images")
    print ListDir("pkg:/images/")
    print ListDir("pkg:/source/")
    fs = CreateObject("roFileSystem")
    print fs.GetVolumeList()
    print fs.CreateDirectory("tmp:/source")
    print WriteAsciiFile("tmp:/test.txt", "some test contents") ' write good path
    print CopyFile("tmp:/test.txt", "tmp:/source/test_backup.txt") ' copy good path
    print fs.GetDirectoryListing("tmp:/source")
    print fs.Delete("tmp:/source/test_backup.txt")
    print fs.GetDirectoryListing("tmp:/source/")
end sub