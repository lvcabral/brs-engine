sub main()
    testGoto()
end sub

sub testGoto()
    appInfo = CreateObject("roAppInfo")
    counter = 0
    inicio:
    print "     ID: " ; appInfo.GetID()
    print "  DevID: " ; appInfo.GetDevID()
    print "  Title: " ; appInfo.GetTitle()
    print "Version: " ; appInfo.GetVersion()
    counter++
    if counter < 5
        print "goto inicio"
        goto inicio
    else if counter = 5
        print "goto final"
        goto final
    end if
    return
	if counter >= 5
        final:
        for x = 1 to 2
            print "final: " ; x
            if x = 2
                goto volta
            end if
            for i = 1 to 2
                print "final: " ; x ; " - " ; i
            end for
            volta:
            if x = 2
                print "returning to inicio"
                goto inicio
            end if
        end for
	end if
end sub
