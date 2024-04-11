Sub Main()
    m.files = CreateObject("roFileSystem")
    screen = CreateObject("roScreen", true, 1280, 720)
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)
	print "App Manifest"
	print ReadAsciiFile("pkg:/manifest")
	print "Downloading JPEG with EXIF"
	'https://www.w3.org/MarkUp/Test/xhtml-print/20050519/tests/jpeg420exif.jpg
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/long_description.jpg
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/tests/35-empty.jpg
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/xmp/no_exif.jpg
	'https://github.com/ianare/exif-samples/blob/master/jpg/Canon_PowerShot_S40.jpg?raw=true
	'https://github.com/ianare/exif-samples/blob/master/jpg/invalid/image00971.jpg?raw=true
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/PaintTool_sample.jpg
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/gps/DSCN0040.jpg
	'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/corrupted.jpg
    'https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/hdr/iphone_hdr_NO.jpg
    'https://upload.wikimedia.org/wikipedia/commons/5/5a/Metadata_test_file_-_includes_data_in_IIM%2C_XMP%2C_and_Exif.jpg
    'http://www.ksky.ne.jp/~yamama/jpggpsmap/sample/AkihabaraKousaten.JPG
    'https://theme.zdassets.com/theme_assets/67413/45532dadfd9c8ca95288b732e841e4f21009f479.png
	'https://raw.githubusercontent.com/haraldk/TwelveMonkeys/master/imageio/imageio-jpeg/src/test/resources/jpeg/exif-jpeg-thumbnail-sony-dsc-p150-inverted-colors.jpg
	'https://raw.githubusercontent.com/haraldk/TwelveMonkeys/master/imageio/imageio-jpeg/src/test/resources/jpeg/exif-rgb-thumbnail-bad-exif-kodak-dc210.jpg
	'https://raw.githubusercontent.com/haraldk/TwelveMonkeys/master/imageio/imageio-jpeg/src/test/resources/jpeg/jfif-jfxx-thumbnail-olympus-d320l.jpg
	'https://raw.githubusercontent.com/haraldk/TwelveMonkeys/master/imageio/imageio-jpeg/src/test/resources/jpeg/jfif-grayscale-thumbnail.jpg
     image = CacheFile("https://raw.githubusercontent.com/ianare/exif-samples/master/jpg/hdr/iphone_hdr_NO.jpg", "jpeg420exif.jpg")
    meta = CreateObject("roImageMetadata")
    meta.SetUrl(image)
    print "------------- GetRawExif() ----------------------"
    allexif = meta.GetRawExif()
    printAA(allexif)
    print "------------- GetMetadata() ---------------------"
    simple = meta.GetMetadata()
    print simple
    if simple?.datetime <> invalid
        print simple.datetime.toISOString()
    end if
    print "------------- GetRawExifTag() -------------------------"
    print meta.GetRawExifTag(2, &h9214)
    print meta.GetRawExifTag(3, 2)

    print "------------- GetThumbnail() -------------------------"
    thumbnail = meta.GetThumbnail()
    print thumbnail
    image = ""
    if (thumbnail?.bytes <> invalid)
        imgtype = thumbnail.type
        image_ext=""
        if (imgtype = "image/jpeg" or imgtype = "jpg")
            image_ext = "jpg"
        else if (imgtype = "image/png" or imgtype = "png")
            image_ext = "png"
        else
            image_ext = "jpg"
        end if
        image = "tmp:/Thumbnail" + "." + image_ext
        thumbnail.bytes.Writefile(image)
    end if
    'cover = SaveCoverArtFile("tmp:/podcast.mp3")
	if (image <> "")
		bmp = CreateObject("roBitmap", image)
		screen.DrawObject(0,0, bmp)
		screen.swapbuffers()
	end if
    while true
        key = wait(0, port).getInt()
        if key = 0
            exit while
        else if key = 5
            print "device uptime:";  UpTime(0)
        else
            print key
        end if
    end while
End Sub

function CacheFile(url as string, file as string, overwrite = false as boolean) as string
    tmpFile = "tmp:/" + file
    if overwrite or not m.files.Exists(tmpFile)
        http = CreateObject("roUrlTransfer")
        http.SetCertificatesFile("common:/certs/ca-bundle.crt")
        if LCase(Right(file, 4)) = "json"
            http.AddHeader("Content-Type", "application/json")
        end if
        http.EnableEncodings(true)
        http.EnablePeerVerification(false)
        http.SetUrl(url)
        ret = http.GetToFile(tmpFile)
        if ret <> 200
            print "File not cached! http return code: "; ret
            tmpFile = ""
        end if
    end if
    return tmpFile
end function


'******************************************************
'Convert anything to a string
'
'Always returns a string
'******************************************************
Function tostr(any)
    ret = AnyToString(any)
    if ret = invalid ret = type(any)
    if ret = invalid ret = "unknown" 'failsafe
    return ret
End Function


'******************************************************
'islist
'
'Determine if the given object supports the ifList interface
'******************************************************
Function islist(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifArray") = invalid return false
    return true
End Function


'******************************************************
'isint
'
'Determine if the given object supports the ifInt interface
'******************************************************
Function isint(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifInt") = invalid return false
    return true
End Function

'******************************************************
' validstr
'
' always return a valid string. if the argument is
' invalid or not a string, return an empty string
'******************************************************
Function validstr(obj As Dynamic) As String
    if isnonemptystr(obj) return obj
    return ""
End Function


'******************************************************
'isstr
'
'Determine if the given object supports the ifString interface
'******************************************************
Function isstr(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifString") = invalid return false
    return true
End Function


'******************************************************
'isnonemptystr
'
'Determine if the given object supports the ifString interface
'and returns a string of non zero length
'******************************************************
Function isnonemptystr(obj)
    if isnullorempty(obj) return false
    return true
End Function


'******************************************************
'isnullorempty
'
'Determine if the given object is invalid or supports
'the ifString interface and returns a string of non zero length
'******************************************************
Function isnullorempty(obj)
    if obj = invalid return true
    if not isstr(obj) return true
    if Len(obj) = 0 return true
    return false
End Function


'******************************************************
'isbool
'
'Determine if the given object supports the ifBoolean interface
'******************************************************
Function isbool(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifBoolean") = invalid return false
    return true
End Function


'******************************************************
'isfloat
'
'Determine if the given object supports the ifFloat interface
'******************************************************
Function isfloat(obj as dynamic) As Boolean
    if obj = invalid return false
    if GetInterface(obj, "ifFloat") = invalid return false
    return true
End Function


'******************************************************
'itostr
'
'Convert int to string. This is necessary because
'the builtin Stri(x) prepends whitespace
'******************************************************
Function itostr(i As Integer) As String
    str = Stri(i)
    return strTrim(str)
End Function


'******************************************************
'Trim a string
'******************************************************
Function strTrim(str As String) As String
    st=CreateObject("roString")
    st.SetString(str)
    return st.Trim()
End Function


'******************************************************
'Replace substrings in a string. Return new string
'******************************************************
Function strReplace(basestr As String, oldsub As String, newsub As String) As String
    newstr = ""

    i = 1
    while i <= Len(basestr)
        x = Instr(i, basestr, oldsub)
        if x = 0 then
            newstr = newstr + Mid(basestr, i)
            exit while
        endif

        if x > i then
            newstr = newstr + Mid(basestr, i, x-i)
            i = x
        endif

        newstr = newstr + newsub
        i = i + Len(oldsub)
    end while

    return newstr
End Function


'******************************************************
'Get all XML subelements by name
'
'return list of 0 or more elements
'******************************************************
Function GetXMLElementsByName(xml As Object, name As String) As Object
    list = CreateObject("roArray", 100, true)
    if islist(xml.GetBody()) = false return list

    for each e in xml.GetBody()
        if e.GetName() = name then
            list.Push(e)
        endif
    next

    return list
End Function


'******************************************************
'Get all XML subelement's string bodies by name
'
'return list of 0 or more strings
'******************************************************
Function GetXMLElementBodiesByName(xml As Object, name As String) As Object
    list = CreateObject("roArray", 100, true)
    if islist(xml.GetBody()) = false return list

    for each e in xml.GetBody()
        if e.GetName() = name then
            b = e.GetBody()
            if type(b) = "roString" or type(b) = "String" list.Push(b)
        endif
    next

    return list
End Function


'******************************************************
'Get first XML subelement by name
'
'return invalid if not found, else the element
'******************************************************
Function GetFirstXMLElementByName(xml As Object, name As String) As dynamic
    if islist(xml.GetBody()) = false return invalid

    for each e in xml.GetBody()
        if e.GetName() = name return e
    next

    return invalid
End Function


'******************************************************
'Get first XML subelement's string body by name
'
'return invalid if not found, else the subelement's body string
'******************************************************
Function GetFirstXMLElementBodyStringByName(xml As Object, name As String) As dynamic
    e = GetFirstXMLElementByName(xml, name)
    if e = invalid return invalid
    if type(e.GetBody()) <> "roString" and type(e.GetBody()) <> "String" return invalid
    return e.GetBody()
End Function


'******************************************************
'Get the xml element as an integer
'
'return invalid if body not a string, else the integer as converted by strtoi
'******************************************************
Function GetXMLBodyAsInteger(xml As Object) As dynamic
    if type(xml.GetBody()) <> "roString" and type(xml.GetBody()) <> "String" return invalid
    return strtoi(xml.GetBody())
End Function


'******************************************************
'Parse a string into a roXMLElement
'
'return invalid on error, else the xml object
'******************************************************
Function ParseXML(str As String) As dynamic
    if str = invalid return invalid
    xml=CreateObject("roXMLElement")
    if not xml.Parse(str) return invalid
    return xml
End Function


'******************************************************
'Get XML sub elements whose bodies are strings into an associative array.
'subelements that are themselves parents are skipped
'namespace :'s are replaced with _'s
'
'So an XML element like...
'
'<blah>
'    <This>abcdefg</This>
'    <Sucks>xyz</Sucks>
'    <sub>
'        <sub2>
'        ....
'        </sub2>
'    </sub>
'    <ns:doh>homer</ns:doh>
'</blah>
'
'returns an AA with:
'
'aa.This = "abcdefg"
'aa.Sucks = "xyz"
'aa.ns_doh = "homer"
'
'return an empty AA if nothing found
'******************************************************
Sub GetXMLintoAA(xml As Object, aa As Object)
    for each e in xml.GetBody()
        body = e.GetBody()
        if type(body) = "roString" or type(body) = "String" then
            name = e.GetName()
            name = strReplace(name, ":", "_")
            aa.AddReplace(name, body)
        endif
    next
End Sub


'******************************************************
'Walk an AA and print it
'******************************************************
Sub PrintAA(aa as Object)
    print "---- AA ----"
    if aa = invalid
        print "invalid"
        return
    else
        cnt = 0
        for each e in aa
            x = aa[e]
            PrintAny(0, e + ": ", aa[e])
            cnt = cnt + 1
        next
        if cnt = 0
            PrintAny(0, "Nothing from for each. Looks like :", aa)
        endif
    endif
    print "------------"
End Sub


'******************************************************
'Walk a list and print it
'******************************************************
Sub PrintList(list as Object)
    print "---- list ----"
    PrintAnyList(0, list)
    print "--------------"
End Sub


'******************************************************
'Print an associativearray
'******************************************************
Sub PrintAnyAA(depth As Integer, aa as Object)
    for each e in aa
        x = aa[e]
        PrintAny(depth, e + ": ", aa[e])
    next
End Sub


'******************************************************
'Print a list with indent depth
'******************************************************
Sub PrintAnyList(depth As Integer, list as Object)
    i = 0
    for each e in list
        PrintAny(depth, "List(" + itostr(i) + ")= ", e)
        i = i + 1
    next
End Sub


'******************************************************
'Print anything
'******************************************************
Sub PrintAny(depth As Integer, prefix As String, any As Dynamic)
    if depth >= 10
        print "**** TOO DEEP " + itostr(5)
        return
    endif
    prefix = string(depth*2," ") + prefix
    depth = depth + 1
    str = AnyToString(any)
    if str <> invalid
        print prefix + str
        return
    endif
    if type(any) = "roAssociativeArray"
        print prefix + "(assocarr)..."
        PrintAnyAA(depth, any)
        return
    endif
    if islist(any) = true
        print prefix + "(list of " + itostr(any.Count()) + ")..."
        PrintAnyList(depth, any)
        return
    endif

    print prefix + "?" + type(any) + "?"
End Sub


'******************************************************
'Try to convert anything to a string. Only works on simple items.
'******************************************************
Function AnyToString(any As Dynamic) As dynamic
    if any = invalid return "invalid"
    if isstr(any) return chr(34) + any + chr(34)
    if isint(any) return itostr(any) + " : integer"
    if isbool(any)
        if any = true return "true : boolean"
        return "false : boolean"
    endif
    if isfloat(any) return Str(any) + " : float"
    if type(any) = "roTimespan" return itostr(any.TotalMilliseconds()) + "ms : timespan"
    return invalid
End Function


'******************************************************
'Walk an XML tree and print it
'******************************************************
Sub PrintXML(element As Object, depth As Integer)
    print tab(depth*3);"Name: [" + element.GetName() + "]"
    if invalid <> element.GetAttributes() then
        print tab(depth*3);"Attributes: ";
        for each a in element.GetAttributes()
            print a;"=";left(element.GetAttributes()[a], 4000);
            if element.GetAttributes().IsNext() then print ", ";
        next
        print
    endif

    if element.GetBody()=invalid then
        ' print tab(depth*3);"No Body"
    else if type(element.GetBody())="roString" or type(element.GetBody())="String" then
        print tab(depth*3);"Contains string: [" + left(element.GetBody(), 4000) + "]"
    else
        print tab(depth*3);"Contains list:"
        for each e in element.GetBody()
            PrintXML(e, depth+1)
        next
    endif
    print
end sub
