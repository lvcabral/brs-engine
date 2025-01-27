sub init()
    print "INIT: BaseWidget"
    m.something = "in"
    m.top.observeField("baseUri", "onUriChange", ["baseStringField", "baseIntField"])
    m.top.setField("baseUri", "http://www.example.com/base.jpg")
    print "INIT: "; m.global.uri
    print "INIT: "; m.global.bitmapWidth
    print "INIT: "; m.global.bitmapHeight
    print "INIT: "; m.top.baseUri
    print "INIT: "; m
end sub

sub onNormalStringFieldChange(event as Object)
    print "EVENT: BaseWidget onNormalStringFieldChange", m
    print "EVENT: "; event.getData()
end sub

sub onUriChange(event as Object)
    print "EVENT: BaseWidget onUriChange "; m.something
    print "EVENT: ====="
    x = 1
    y = 2
    print "EVENT: "; x + y
    ' print "EVENT: "; event.getData(); event.getInfo().baseIntField
end sub
