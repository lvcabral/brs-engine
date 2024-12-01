sub main()
    files = CreateObject("roFileSystem")
    print "Listing Volumes"
    for each volume in files.GetVolumeList()
        print "   Listing files in "; volume; "/"
        for each file in ListDir(volume + "/")
            print "      - "; file
        end for
    end for
    print "End of Listing"
end sub