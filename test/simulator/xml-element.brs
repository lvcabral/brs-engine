Sub Main()
    print "Test roXMLElement"
    m.http = CreateObject("roUrlTransfer")
    m.http.SetCertificatesFile("common:/certs/ca-bundle.crt")
    rsp = GetString("https://brsfiddle.net/highscores.xml")
    xml=CreateObject("roXMLElement")
    print "GetName(): "; xml.GetName()
    scoretable = []
    if xml.Parse(rsp)
        print "GetName(): "; xml.GetName()
        childelements = xml.GetChildElements()
        print "childelements: "; childelements
        for each item in childelements
            o = CreateObject("roAssociativeArray")
            o.name = item.name.GetText()
            o.score = item.score.GetText()
            Print "name: "; o.name
            print "score: "; o.score
            scoretable.Push(o)
            next
    end if
    print "total items:"; scoretable.count()
End Sub

Function GetString(url as string) as string
    m.http.SetUrl(url)
    return m.http.GetToString()
End Function
