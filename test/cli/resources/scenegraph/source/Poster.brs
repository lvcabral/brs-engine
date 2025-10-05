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
    print "MAIN: poster as child loadWidth:"; posterAsChild.loadWidth
    print m.myName
    ' Test deepCopy and clone
    node = createObject("roSGNode", "ContentNode")
    node.addFields({
        link: "http://www.example.com/image.jpg",
        aa: {id: 1, name: "one"},
        boxedInt: box(5)
    })

    utils = CreateObject("roUtils")
    copy = utils.deepCopy(node)
    clone = node.clone(true)
    print "MAIN: node.link: "; node.link
    print "MAIN: copy.link: "; copy.link
    print "MAIN: clone.link: "; clone.link
    aa = node.aa
    aa.name = "changed"
    node.setField("aa", aa)
    bi = copy.boxedInt
    bi.setInt(10)
    copy.setField("boxedInt", bi)
    print "MAIN: node.aa.name: "; node.aa.name
    print "MAIN: copy.aa.name: "; copy.aa.name
    print "MAIN: clone.aa.name: "; clone.aa.name
    print "MAIN: node.boxedInt: "; node.boxedInt.getInt()
    print "MAIN: copy.boxedInt: "; copy.boxedInt.getInt()
    print "MAIN: clone.boxedInt: "; clone.boxedInt.getInt()
    print "MAIN: isSameObject(node.aa, copy.aa): "; utils.isSameObject(node.aa, copy.aa)
    print "MAIN: isSameObject(node.aa, clone.aa): "; utils.isSameObject(node.aa, clone.aa)
end sub
