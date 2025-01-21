sub Main()
    poster = createObject("roSGNode", "Poster")
    print "poster node type:" type(poster)
    print "poster node subtype:" poster.subtype()
    print "poster node width:" poster.width
    print "poster node height:" poster.height

    parent = createObject("roSGNode", "NormalWidget")
    posterAsChild = parent.findNode("poster")
    print "poster as child audioGuideText:" posterAsChild.audioGuideText
    print "poster as child uri:" posterAsChild.uri
    print "poster as child bitmapWidth:" posterAsChild.bitmapWidth
end sub
