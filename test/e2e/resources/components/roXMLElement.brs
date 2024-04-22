sub main()
    xmlParser = createObject("roXMLElement")
    ?"xmlParser = "xmlParser 
    ?"type(xmlParser) = "type(xmlParser) 
    ?"parse bad xml string, result = "xmlParser.parse("some_xml_doc")
    ?"parse good xml string, result = "xmlParser.parse("<tag1 id=""someId"" attr1=""0""> <Child1 id=""id1""></Child1> <CHILD1 id=""id2""></CHILD1> </tag1>")
    ?"getName() = " xmlParser.getName()
    ?"getAttributes() = " xmlParser.getAttributes()
    children = xmlParser.getNamedElementsCi("child1")
    ?"getNamedElementsCi(""child1"") count = " children.count()
    ?"name of first child  = "children[0].getName()
    ?"mame of second child = "children[1].getName()
end sub