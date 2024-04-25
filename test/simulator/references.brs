sub main()
    print  "Start Reference Test----"
    goFirst()
end sub

sub goFirst()
    toTrack = CreateObject("roBitmap", {width: 100, height: 100})
    array = [toTrack]
    aa = {}
    aa.toTrack = toTrack
    aa.array = array
    goDown(toTrack)
    print  "End Reference Test----"
end sub

sub goDown(obj)
    print (type(obj))
end sub