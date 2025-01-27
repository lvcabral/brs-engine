sub Main()
    m.myName = "Main -----------------------------------------------"
    screen = CreateObject("roSGScreen")
    glb = screen.getGlobalNode()
    glb.addFields({
        uri: "http://www.example.com/image.jpg",
        bitmapWidth: 100,
        bitmapHeight: 200
    })
    print m.myName
    poster = createObject("roSGNode", "Poster")
    print "MAIN: poster node type:" type(poster)
    print "MAIN: poster node subtype:" poster.subtype()
    print "MAIN: poster node width:" poster.width
    print "MAIN: poster node height:" poster.height
    print m.myName
    parent = createObject("roSGNode", "NormalWidget")
    print "MAIN: "; glb.bitmapHeight; glb.bitmapWidth
    parent.setField("normalStringField", "Hello World!")
    parent.setField("baseUri", "http://www.example.com/again.jpg")
    print m.myName
    posterAsChild = parent.findNode("poster")
    print "MAIN: poster as child audioGuideText:" posterAsChild.audioGuideText
    print "MAIN: poster as child uri:" posterAsChild.uri
    print "MAIN: poster as child bitmapWidth:"; posterAsChild.bitmapWidth
    print m.myName
end sub
