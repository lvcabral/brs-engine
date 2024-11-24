sub main()
    print ListDir("pkg:/")
    print ListDir("pkg:/assets/")
    print ListDir("pkg:/assets/images")
    print ListDir("pkg:/images/")
    print ListDir("pkg:/source/")
    fs = CreateObject("roFileSystem")
    print fs.GetVolumeList()
    print fs.CreateDirectory("tmp:/source")
    print fs.CreateDirectory("tmp:/source/new")
    print WriteAsciiFile("tmp:/test.txt", "some test contents") ' write good path
    print fs.copyFile("tmp:/test.txt", "tmp:/source/test_backup.txt")
    print fs.GetDirectoryListing("tmp:/source")
    print fs.GetDirectoryListing("tmp:/")
    print fs.rename("tmp:/test.txt", "tmp:/source/test_original.txt")
    print fs.Delete("tmp:/source/test_backup.txt")
    print fs.GetDirectoryListing("tmp:/source/")
    print fs.GetDirectoryListing("tmp:/")
    print fs.stat("pkg:/images/sprite.png")
    print fs.stat("pkg:/assets/")
    print fs.stat("tmp:/source/test_original.txt")
    print fs.match("pkg:/assets/", "*.png")
    print WriteAsciiFile("tmp:/source/new/newtest.txt", "some new test contents") ' write good path
    print fs.find("pkg:/","e")
    print fs.findRecurse("pkg:/","e")
    print fs.GetDirectoryListing("tmp:/source/new")
    print fs.GetDirectoryListing("tmp:/")
    print fs.delete("tmp:/source")
    print fs.GetDirectoryListing("tmp:/")
    print fs.GetDirectoryListing("common:/")
    print fs.GetDirectoryListing("common:/roku_browser/")
    print ReadAsciiFile("common:/roku_browser/RokuBrowser.brs")
    print fs.GetDirectoryListing("common:/fonts/")
end sub